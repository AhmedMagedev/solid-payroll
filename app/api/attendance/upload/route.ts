import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient();

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
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    // Process attendance records
    const recordsByEmployeeAndDay = new Map<string, { records: string[], employeeId: number, date: string }>();

    // Parse each line of the file
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      
      if (parts.length < 2) {
        continue; // Skip invalid lines
      }
      
      const employeeId = parseInt(parts[0], 10);
      if (isNaN(employeeId)) continue;
      
      const timestampStr = `${parts[1]} ${parts[2]}`;
      const timestamp = new Date(timestampStr);
      
      if (isNaN(timestamp.getTime())) continue;
      
      const dateStr = timestamp.toISOString().split('T')[0];
      const key = `${employeeId}-${dateStr}`;
      
      if (!recordsByEmployeeAndDay.has(key)) {
        recordsByEmployeeAndDay.set(key, {
          records: [],
          employeeId,
          date: dateStr
        });
      }
      
      recordsByEmployeeAndDay.get(key)!.records.push(timestampStr);
    }

    const attendanceRecords = [];

    // Process each employee's daily records
    for (const { records, employeeId, date } of recordsByEmployeeAndDay.values()) {
      if (records.length === 0) continue;
      
      // Sort records by timestamp
      records.sort();
      
      const checkIn = new Date(records[0]);
      const checkOut = records.length > 1 ? new Date(records[records.length - 1]) : null;
      
      let hoursWorked = null;
      if (checkOut) {
        const diffMs = checkOut.getTime() - checkIn.getTime();
        hoursWorked = diffMs / (1000 * 60 * 60); // Convert ms to hours
      }

      // Check if the employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      });

      if (!employee) {
        continue; // Skip if employee doesn't exist
      }

      // Create or update attendance record
      try {
        const attendance = await prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId,
              date: new Date(date)
            }
          },
          update: {
            checkIn,
            checkOut,
            hoursWorked
          },
          create: {
            employeeId,
            date: new Date(date),
            checkIn,
            checkOut,
            hoursWorked
          }
        });

        attendanceRecords.push(attendance);
      } catch (err) {
        console.error(`Error processing record for employee ${employeeId} on ${date}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${attendanceRecords.length} attendance records.`,
      recordsCount: attendanceRecords.length
    });
  } catch (error: unknown) {
    console.error('Error processing attendance upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process attendance log', details: errorMessage },
      { status: 500 }
    );
  }
} 