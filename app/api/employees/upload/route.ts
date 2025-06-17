import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

// Function to parse the dat file content
async function parseEmployeesFromDatFile(buffer: Buffer) {
  // First attempt: try to reconstruct the data by looking for patterns
  const content = buffer.toString();
  
  console.log("File content sample:", content.substring(0, 200)); // Debug: see the start of the file
  
  // Create a more robust pattern matcher for employees
  // Look for patterns like "digits followed by a name followed by digits"
  const employeePattern = /(\d+)([A-Za-z\s]+?)(\d+)/g;
  
  let matches;
  const employeeData = [];
  let employeeCount = 0;
  
  // Collect all potential employee matches
  while ((matches = employeePattern.exec(content)) !== null) {
    employeeCount++;
    const fullName = matches[2]?.trim();
    
    console.log(`Found potential employee #${employeeCount}:`, { 
      fullName
    });
    
    // Skip entries with incomplete data
    if (!fullName || fullName.length < 3) {
      continue;
    }
    
    // Clean the name (ensuring no numeric characters)
    const cleanName = fullName.replace(/\d+/g, '').trim();
    
    // Generate email from name
    const nameParts = cleanName.split(' ').filter(part => part.trim().length > 0);
    if (nameParts.length === 0) continue;
    
    const firstName = nameParts[0].toLowerCase();
    // Find the last name (if it exists)
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';
    
    // Normalize the name to ensure valid email characters
    const normalizeForEmail = (str: string) => str
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[^a-z0-9]/g, ""); // Remove any non-alphanumeric
      
    const emailFirstName = normalizeForEmail(firstName);
    const emailLastName = normalizeForEmail(lastName);
    
    if (!emailFirstName) continue; // Skip if no valid first name
    
    const email = `${emailFirstName}.${emailLastName || 'nolastname'}@solid-metals.com`;
    
    // Use default values instead of trying to extract position from random numbers
    const position = 'Employee'; // Default position for all uploaded employees
    const hourlyRate = 25; // Default hourly rate (can be edited later)
    
    employeeData.push({
      name: cleanName,
      email,
      position,
      hourlyRate,
      paymentBasis: 'Monthly' // Default payment basis
    });
    
    console.log(`Processed employee: ${cleanName} (${email}) - ${position} - Hourly Rate: $${hourlyRate}`);
  }
  
  // Alternative approach: try to find fixed-width patterns if the regex didn't work
  if (employeeData.length === 0) {
    console.log("Regex pattern didn't find any employees, trying fixed-width approach");
    
    // Split content into chunks of reasonable size that might contain employee data
    const contentBytes = Buffer.from(content);
    const chunks = [];
    
    // Try to identify chunks of 40-60 bytes that might represent one employee
    for (let i = 0; i < contentBytes.length; i += 40) {
      const chunk = contentBytes.slice(i, i + 60).toString().trim();
      if (chunk.length > 10) { // Skip very small chunks
        chunks.push(chunk);
      }
    }
    
    console.log(`Split content into ${chunks.length} potential employee chunks`);
    
    // Process each chunk
    for (const chunk of chunks) {
      try {
        // Look for a name-like pattern: sequential alphabetic characters with spaces
        const nameMatch = chunk.match(/[A-Za-z\s]{10,}/);
        if (nameMatch) {
          const name = nameMatch[0].trim();
          
          // Generate email from the extracted name
          const nameParts = name.split(' ').filter(part => part.trim().length > 0);
          if (nameParts.length === 0) continue;
          
          const firstName = nameParts[0].toLowerCase();
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';
          
          // Normalize for email
          const normalizeForEmail = (str: string) => str
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
            
          const emailFirstName = normalizeForEmail(firstName);
          const emailLastName = normalizeForEmail(lastName);
          
          if (!emailFirstName) continue;
          
          const email = `${emailFirstName}.${emailLastName || 'nolastname'}@solid-metals.com`;
          
          // Use default values instead of generating dummy positions
          const position = 'Employee'; // Default position for all uploaded employees
          const hourlyRate = 25; // Default hourly rate (can be edited later)
          
          employeeData.push({
            name,
            email,
            position,
            hourlyRate,
            paymentBasis: 'Monthly' // Default payment basis
          });
          
          console.log(`From chunk extracted: ${name} (${email}) - ${position} - Hourly Rate: $${hourlyRate}`);
        }
      } catch (error) {
        console.error("Error processing chunk:", chunk, error);
      }
    }
  }
  
  // Deduplicate by email (in case our parsing found duplicates)
  const uniqueEmails = new Set();
  const uniqueEmployees = employeeData.filter(emp => {
    if (uniqueEmails.has(emp.email)) {
      return false; // Skip duplicate
    }
    uniqueEmails.add(emp.email);
    return true;
  });
  
  console.log(`Parsed ${uniqueEmployees.length} unique employees from the file`);
  return uniqueEmployees;
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
    
    console.log(`[API Upload] Token check: ${token ? 'found' : 'not found'}`);
    console.log(`[API Upload] All cookies:`, JSON.stringify(Array.from(request.cookies.getAll())));
    
    if (!token) {
      console.log('[API] Upload attempt without authentication');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      console.log('[API] Upload attempt with invalid token');
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }
    
    // Check if the request is a multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse employees from the file
    const employees = await parseEmployeesFromDatFile(buffer);
    
    if (employees.length === 0) {
      return NextResponse.json({ 
        error: 'No valid employee data found in file',
        details: 'The parser could not identify any employees in the provided file.'
      }, { status: 400 });
    }
    
    console.log(`[API] Found ${employees.length} employees in uploaded file`);
    
    // Save employees to the database
    const results = [];
    let createdCount = 0;
    let errorCount = 0;
    
    console.log(`[API] Starting to save ${employees.length} employees to database...`);
    
    for (const employeeData of employees) {
      try {
        console.log(`[API] Checking if employee exists: ${employeeData.email}`);
        
        // Check if employee with this email already exists
        const existingEmployee = await prisma.employee.findUnique({
          where: { email: employeeData.email }
        });
        
        if (!existingEmployee) {
          console.log(`[API] Creating new employee: ${employeeData.name} (${employeeData.email})`);
          console.log(`[API] Employee data:`, JSON.stringify(employeeData, null, 2));
          
          // Create new employee
          const employee = await prisma.employee.create({
            data: employeeData
          });
          
          console.log(`[API] Successfully created employee with ID: ${employee.id}`);
          results.push({ success: true, employee });
          createdCount++;
        } else {
          console.log(`[API] Employee already exists: ${employeeData.email}`);
          results.push({ 
            success: false, 
            error: `Employee with email ${employeeData.email} already exists`,
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
    
    console.log(`[API] Database save completed. Created: ${createdCount}, Errors: ${errorCount}, Total: ${employees.length}`);
    
    const responseData = {
      message: 'File processed successfully',
      createdCount,
      errorCount,
      totalFound: employees.length,
      results
    };
    
    console.log(`[API] Upload response:`, JSON.stringify({
      message: responseData.message,
      createdCount: responseData.createdCount,
      errorCount: responseData.errorCount,
      totalFound: responseData.totalFound,
      resultsCount: responseData.results.length
    }, null, 2));
    
    return NextResponse.json(responseData, { status: 201 });
    
  } catch (error) {
    console.error('Error processing employee upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process employee data file' 
    }, { status: 500 });
  }
} 