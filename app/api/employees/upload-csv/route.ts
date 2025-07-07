import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';

const prisma = new PrismaClient();

// Configuration for batch processing
const BATCH_SIZE = 10; // Process 10 employees at a time
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max file size
const MAX_EMPLOYEES = 1000; // Maximum number of employees per upload

// Function to parse CSV content
function parseCSV(content: string): string[][] {
  const lines = content.split('\n').filter(line => line.trim());
  const result: string[][] = [];
  
  for (const line of lines) {
    // Simple CSV parsing that handles commas inside quotes
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    row.push(current.trim());
    
    if (row.length > 0 && row[0]) {
      result.push(row);
    }
  }
  
  return result;
}

// Function to generate email from name
function generateEmail(name: string): string {
  const nameParts = name.split(' ').filter(part => part.trim().length > 0);
  if (nameParts.length === 0) return 'unknown@solid-metals.com';
  
  const firstName = nameParts[0].toLowerCase();
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';
  
  // Normalize for email
  const normalizeForEmail = (str: string) => str
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
    
  const emailFirstName = normalizeForEmail(firstName);
  const emailLastName = normalizeForEmail(lastName);
  
  if (!emailFirstName) return 'unknown@solid-metals.com';
  
  return `${emailFirstName}.${emailLastName || 'nolastname'}@solid-metals.com`;
}

// Function to parse employees from CSV data
function parseEmployeesFromCSV(content: string) {
  const rows = parseCSV(content);
  
  if (rows.length === 0) {
    throw new Error('No data found in file');
  }
  
  // Skip header row if it exists (check if first row contains text like "Employee Name" or "Device ID")
  const firstRow = rows[0];
  const hasHeader = firstRow.some(cell => 
    cell.toLowerCase().includes('employee') || 
    cell.toLowerCase().includes('device') || 
    cell.toLowerCase().includes('name') || 
    cell.toLowerCase().includes('rate')
  );
  
  const dataRows = hasHeader ? rows.slice(1) : rows;
  
  if (dataRows.length === 0) {
    throw new Error('No employee data found after header row');
  }
  
  if (dataRows.length > MAX_EMPLOYEES) {
    throw new Error(`Too many employees in file. Maximum allowed: ${MAX_EMPLOYEES}, found: ${dataRows.length}`);
  }
  
  const employees = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = hasHeader ? i + 2 : i + 1; // For error reporting
    
    if (row.length < 4) {
      console.warn(`Row ${rowNumber}: Insufficient columns (${row.length}/4 required)`);
      continue;
    }
    
    const [name, deviceId, hourlyRate, paymentBasis] = row;
    
    // Validate required fields
    if (!name || !name.trim()) {
      console.warn(`Row ${rowNumber}: Missing employee name`);
      continue;
    }
    
    if (!deviceId || !deviceId.trim()) {
      console.warn(`Row ${rowNumber}: Missing device ID`);
      continue;
    }
    
    if (!hourlyRate || isNaN(Number(hourlyRate))) {
      console.warn(`Row ${rowNumber}: Invalid hourly rate: ${hourlyRate}`);
      continue;
    }
    
    if (!paymentBasis || !['Monthly', 'Weekly'].includes(paymentBasis.trim())) {
      console.warn(`Row ${rowNumber}: Invalid payment basis: ${paymentBasis} (must be "Monthly" or "Weekly")`);
      continue;
    }
    
    // Clean and prepare data
    const cleanName = name.trim();
    const cleanDeviceId = deviceId.trim();
    const cleanHourlyRate = parseFloat(hourlyRate);
    const cleanPaymentBasis = paymentBasis.trim();
    
    employees.push({
      name: cleanName,
      email: generateEmail(cleanName),
      position: 'Employee', // Default position
      fingerprintId: cleanDeviceId,
              hourlyRate: cleanHourlyRate,
      paymentBasis: cleanPaymentBasis
    });
  }
  
  return employees;
}

// Function to process employees in batches
async function processEmployeesInBatches(employees: Array<{
  name: string;
  email: string;
  position: string;
  fingerprintId: string;
  hourlyRate: number;
  paymentBasis: string;
}>) {
  const results = [];
  let createdCount = 0;
  let errorCount = 0;
  
  console.log(`[API] Processing ${employees.length} employees in batches of ${BATCH_SIZE}`);
  
  for (let i = 0; i < employees.length; i += BATCH_SIZE) {
    const batch = employees.slice(i, i + BATCH_SIZE);
    console.log(`[API] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(employees.length / BATCH_SIZE)}`);
    
    for (const employeeData of batch) {
      try {
        console.log(`[API] Checking if employee exists: ${employeeData.email} (Device ID: ${employeeData.fingerprintId})`);
        
        // Check if employee with this email or fingerprint ID already exists
        const existingEmployee = await prisma.employee.findFirst({
          where: {
            OR: [
              { email: employeeData.email },
              { fingerprintId: employeeData.fingerprintId }
            ]
          }
        });
        
        if (!existingEmployee) {
          console.log(`[API] Creating new employee: ${employeeData.name} (${employeeData.email})`);
          
          // Create new employee
          const employee = await prisma.employee.create({
            data: employeeData
          });
          
          console.log(`[API] Successfully created employee with ID: ${employee.id}`);
          results.push({ success: true, employee });
          createdCount++;
        } else {
          const conflictField = existingEmployee.email === employeeData.email ? 'email' : 'device ID';
          const conflictValue = existingEmployee.email === employeeData.email ? employeeData.email : employeeData.fingerprintId;
          
          console.log(`[API] Employee conflict: ${conflictField} ${conflictValue} already exists`);
          results.push({ 
            success: false, 
            error: `Employee with ${conflictField} ${conflictValue} already exists`,
            employeeData 
          });
          errorCount++;
        }
      } catch (error) {
        console.error(`[API] Error creating employee ${employeeData.email}:`, error);
        results.push({ 
          success: false, 
          error: 'Database error',
          employeeData,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }
    
    // Small delay between batches to prevent overwhelming the database
    if (i + BATCH_SIZE < employees.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return { results, createdCount, errorCount };
}

export async function POST(request: NextRequest) {
  try {
    // Check for authentication
    let token = request.cookies.get('auth_token')?.value;
    
    // Check Authorization header if no cookie token
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    console.log(`[API CSV Upload] Token check: ${token ? 'found' : 'not found'}`);
    
    if (!token) {
      console.log('[API] CSV upload attempt without authentication');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      console.log('[API] CSV upload attempt with invalid token');
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or Excel file.' },
        { status: 400 }
      );
    }

    // Read file content
    let fileContent: string;
    
    if (fileName.endsWith('.csv')) {
      fileContent = await file.text();
    } else {
      // For Excel files, we'll need to handle them as CSV for now
      // In a real implementation, you'd use a library like 'xlsx' to parse Excel files
      return NextResponse.json(
        { error: 'Excel files are not yet supported. Please convert to CSV format.' },
        { status: 400 }
      );
    }

    // Parse employees from the file
    let employees;
    try {
      employees = parseEmployeesFromCSV(fileContent);
    } catch (parseError) {
      console.error('[API] Error parsing CSV:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse file',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 400 });
    }

    if (employees.length === 0) {
      return NextResponse.json({ 
        error: 'No valid employee data found in file',
        details: 'The file contains no valid employee records. Please check the format and try again.'
      }, { status: 400 });
    }

    console.log(`[API] Found ${employees.length} employees in uploaded CSV file`);
    
    // Check for duplicate fingerprint IDs in the file
    const fingerprintIds = employees.map(emp => emp.fingerprintId);
    const duplicateIds = fingerprintIds.filter((id, index) => fingerprintIds.indexOf(id) !== index);
    
    if (duplicateIds.length > 0) {
      return NextResponse.json({ 
        error: 'Duplicate device IDs found in file',
        details: `The following device IDs appear multiple times: ${[...new Set(duplicateIds)].join(', ')}`
      }, { status: 400 });
    }

    // Process employees in batches
    const { results, createdCount, errorCount } = await processEmployeesInBatches(employees);

    console.log(`[API] Database save completed. Created: ${createdCount}, Errors: ${errorCount}, Total: ${employees.length}`);
    
    const responseData = {
      message: 'Employee file processed successfully',
      createdCount,
      errorCount,
      totalFound: employees.length,
      results
    };

    console.log(`[API] CSV upload response:`, JSON.stringify({
      message: responseData.message,
      createdCount: responseData.createdCount,
      errorCount: responseData.errorCount,
      totalFound: responseData.totalFound,
      resultsCount: responseData.results.length
    }, null, 2));

    return NextResponse.json(responseData, { status: 201 });
    
  } catch (error) {
    console.error('Error processing employee CSV upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process employee data file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 