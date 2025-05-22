import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

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
    const idOrPassword = matches[1]?.trim();
    const fullName = matches[2]?.trim();
    const positionId = matches[3]?.trim();
    
    console.log(`Found potential employee #${employeeCount}:`, { 
      idOrPassword, 
      fullName,
      positionId
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
    
    const email = `${emailFirstName}.${emailLastName || 'nolastname'}@solidpayroll.com`;
    
    // Map position IDs to titles
    const positions: Record<string, string> = {
      '1': 'Manager',
      '2': 'Developer',
      '3': 'Designer',
      '4': 'HR Specialist',
      '5': 'Accountant',
      '6': 'Sales Representative',
      '7': 'Marketing Specialist',
      '8': 'Customer Support',
      '9': 'QA Engineer',
      '10': 'IT Support'
    };
    
    // Get first digit of positionId if it's longer than expected
    const firstDigit = positionId.match(/^\d{1,2}/)?.[0] || '1';
    const position = positions[firstDigit] || `Position ${firstDigit}`;
    
    // Calculate salary based on position
    let salary = 50000; // Default base salary
    const positionDigit = parseInt(firstDigit);
    
    if (positionDigit === 1) salary = 80000;
    else if (positionDigit === 2) salary = 65000;
    else if (positionDigit === 3) salary = 60000;
    else if (positionDigit === 4) salary = 55000;
    else if (positionDigit <= 9) salary = 50000 - ((positionDigit - 5) * 2000);
    
    employeeData.push({
      name: cleanName,
      email,
      position,
      salary
    });
    
    console.log(`Processed employee: ${cleanName} (${email}) - ${position} - $${salary}`);
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
          
          // Look for a digit that could be a position ID
          const positionMatch = chunk.match(/\d{1,2}/);
          const positionId = positionMatch ? positionMatch[0] : '1';
          
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
          
          const email = `${emailFirstName}.${emailLastName || 'nolastname'}@solidpayroll.com`;
          
          // Map position to title (reusing logic from above)
          const positions: Record<string, string> = {
            '1': 'Manager',
            '2': 'Developer',
            '3': 'Designer',
            '4': 'HR Specialist',
            '5': 'Accountant'
          };
          
          const position = positions[positionId] || `Position ${positionId}`;
          
          // Set salary based on position
          let salary = 50000;
          const posNum = parseInt(positionId);
          if (posNum === 1) salary = 80000;
          else if (posNum === 2) salary = 65000;
          else if (posNum === 3) salary = 60000;
          else if (posNum === 4) salary = 55000;
          
          employeeData.push({
            name,
            email,
            position,
            salary
          });
          
          console.log(`From chunk extracted: ${name} (${email}) - ${position} - $${salary}`);
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
    const session = request.cookies.get('auth_session')?.value;
    console.log(`[API Upload] Session check: ${session ? session.substring(0,10) + '...' : 'not found'}`);
    console.log(`[API Upload] All cookies:`, JSON.stringify(Array.from(request.cookies.getAll())));
    
    if (!session) {
      console.log('[API] Upload attempt without authentication');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
    
    for (const employeeData of employees) {
      try {
        // Check if employee with this email already exists
        const existingEmployee = await prisma.employee.findUnique({
          where: { email: employeeData.email }
        });
        
        if (!existingEmployee) {
          // Create new employee
          const employee = await prisma.employee.create({
            data: employeeData
          });
          results.push({ success: true, employee });
          createdCount++;
        } else {
          results.push({ 
            success: false, 
            error: `Employee with email ${employeeData.email} already exists`,
            employeeData 
          });
          errorCount++;
        }
      } catch (error) {
        console.error('Error creating employee:', error);
        results.push({ 
          success: false, 
          error: 'Database error',
          employeeData 
        });
        errorCount++;
      }
    }
    
    return NextResponse.json({
      message: 'File processed successfully',
      createdCount,
      errorCount,
      totalFound: employees.length,
      results
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error processing employee upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process employee data file' 
    }, { status: 500 });
  }
} 