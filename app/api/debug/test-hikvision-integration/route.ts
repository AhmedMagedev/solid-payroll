import { NextRequest, NextResponse } from 'next/server';
import HikvisionClient from '@/lib/hikvision-client';
import { prisma } from '@/app/lib/prisma';
import { getHikvisionConfig, sanitizeEmployeeName } from '@/lib/hikvision-config';

export async function POST(request: NextRequest) {
  try {
    console.log('[Debug] Testing Hikvision integration...');
    
    // Get date range from request or default to last 7 days
    const body = await request.json().catch(() => ({}));
    const startDate = body.startDate ? new Date(body.startDate) : (() => {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      return date;
    })();
    const endDate = body.endDate ? new Date(body.endDate) : new Date();

    console.log('[Debug] Date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Test Hikvision client
    const hikvisionClient = new HikvisionClient();
    const attendanceData = await hikvisionClient.pullAttendanceData(startDate, endDate);

    if (!attendanceData) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve data from Hikvision API'
      }, { status: 500 });
    }

    console.log('[Debug] Retrieved attendance data:', attendanceData);

    // Process the data
    const processedResults = await processHikvisionAttendanceData(attendanceData);

    return NextResponse.json({
      success: true,
      message: 'Hikvision integration test completed',
      data: {
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        hikvisionResponse: attendanceData,
        processedResults
      }
    });

  } catch (error) {
    console.error('[Debug] Hikvision integration test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Integration test failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}

// Function to process Hikvision attendance data (same as in the main route)
async function processHikvisionAttendanceData(data: { AcsEvent?: { InfoList?: Array<{ employeeNoString?: string; time: string; eventType?: string; majorEventType?: number; subEventType?: number; name?: string }> } }) {
  const results = {
    eventsProcessed: 0,
    employeesMatched: 0,
    employeesAutoCreated: 0,
    employeesNotFound: [] as string[],
    attendanceRecordsCreated: 0,
    attendanceRecordsUpdated: 0,
    errors: [] as string[]
  };

  try {
    console.log('[Debug Process] Processing attendance data...');
    
    if (!data.AcsEvent || !data.AcsEvent.InfoList) {
      console.log('[Debug Process] No attendance events found in response');
      return results;
    }
    
    const events = data.AcsEvent.InfoList;
    console.log(`[Debug Process] Found ${events.length} attendance events`);
    
    for (const event of events) {
      try {
        results.eventsProcessed++;
        
        // Extract data from event
        const employeeNo = event.employeeNoString;
        const eventTime = new Date(event.time);
        
        if (!employeeNo) {
          console.log('[Debug Process] Skipping event with no employee number');
          results.errors.push('Event with no employee number found');
          continue;
        }
        
        // Find employee by Hikvision employee number
        let employee = await prisma.employee.findFirst({
          where: {
            OR: [
              { hikvisionEmployeeId: employeeNo },
              { fingerprintId: employeeNo } // Fallback to fingerprintId for backward compatibility
            ]
          }
        });
        
        if (!employee) {
          console.log(`[Debug Process] Employee not found for Hikvision ID: ${employeeNo}, creating new employee...`);
          
          // Auto-create employee from Hikvision data (minimal data only)
          const config = getHikvisionConfig();
          const employeeName = sanitizeEmployeeName(event.name, employeeNo);
          
          try {
            employee = await prisma.employee.create({
              data: {
                name: employeeName,
                // email is optional, so we don't include it
                position: config.position,
                hikvisionEmployeeId: employeeNo,
                fingerprintId: employeeNo, // Also set as fingerprintId for backward compatibility
                // hourlyRate and paymentBasis will use schema defaults (0 and "Daily")
              }
            });
            
            console.log(`[Debug Process] Auto-created employee: ${employee.name} (ID: ${employee.id}) for Hikvision ID: ${employeeNo}`);
            results.employeesAutoCreated++;
          } catch (createError) {
            console.error(`[Debug Process] Failed to create employee for Hikvision ID ${employeeNo}:`, createError);
            results.errors.push(`Failed to create employee for Hikvision ID ${employeeNo}: ${(createError as Error).message}`);
            results.employeesNotFound.push(employeeNo);
            continue;
          }
        }
        
        results.employeesMatched++;
        console.log(`[Debug Process] Processing event for employee: ${employee.name} at ${eventTime.toISOString()}`);
        
        // Get the date for grouping (local date)
        const eventDate = new Date(eventTime.getFullYear(), eventTime.getMonth(), eventTime.getDate());
        
        // Check if we already have attendance for this employee on this date
        const existingAttendance = await prisma.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: eventDate
            }
          }
        });
        
        if (existingAttendance) {
          // Update existing attendance record
          const updateData: {
            checkIn?: Date;
            checkOut?: Date;
            hoursWorked?: number;
            actualHoursWorked?: number;
            updatedAt?: Date;
          } = {};
          
          if (!existingAttendance.checkIn || eventTime < existingAttendance.checkIn) {
            updateData.checkIn = eventTime;
          }
          
          if (!existingAttendance.checkOut || eventTime > (existingAttendance.checkOut || new Date(0))) {
            updateData.checkOut = eventTime;
          }
          
          // Recalculate hours worked if we have both check-in and check-out
          if (updateData.checkIn || updateData.checkOut) {
            const checkIn = updateData.checkIn || existingAttendance.checkIn;
            const checkOut = updateData.checkOut || existingAttendance.checkOut;
            
            if (checkIn && checkOut && checkOut > checkIn) {
              updateData.hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
              updateData.actualHoursWorked = updateData.hoursWorked;
            }
          }
          
          if (Object.keys(updateData).length > 0) {
            await prisma.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                ...updateData,
                updatedAt: new Date()
              }
            });
            results.attendanceRecordsUpdated++;
            console.log(`[Debug Process] Updated attendance for ${employee.name} on ${eventDate.toDateString()}`);
          }
        } else {
          // Create new attendance record
          await prisma.attendance.create({
            data: {
              employeeId: employee.id,
              date: eventDate,
              checkIn: eventTime,
              checkOut: null, // Will be updated by subsequent events
              hoursWorked: null,
              actualHoursWorked: 0,
              isPaidDay: true // Will be calculated later by penalty system
            }
          });
          results.attendanceRecordsCreated++;
          console.log(`[Debug Process] Created new attendance for ${employee.name} on ${eventDate.toDateString()}`);
        }
        
      } catch (eventError) {
        console.error('[Debug Process] Error processing individual event:', eventError);
        results.errors.push(`Error processing event: ${(eventError as Error).message}`);
      }
    }
    
    console.log(`[Debug Process] Successfully processed ${results.eventsProcessed} events`);
    return results;
    
  } catch (error) {
    console.error('[Debug Process] Error processing attendance data:', error);
    results.errors.push(`Processing error: ${(error as Error).message}`);
    return results;
  }
} 