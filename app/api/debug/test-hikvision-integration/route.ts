import { NextRequest, NextResponse } from 'next/server';
import HikvisionClient from '@/lib/hikvision-client';
import { pullHikvisionDataWithCurl, pullHikvisionDataWithFetch } from '@/lib/hikvision-curl';
import { prisma } from '@/app/lib/prisma';
import { getHikvisionConfig, sanitizeEmployeeName } from '@/lib/hikvision-config';

export async function POST(request: NextRequest) {
  try {
    console.log('[Debug] Testing Hikvision integration...');
    
    // Get date range from request or default to 7 days backward from today
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

    // Try curl approach first (most reliable)
    console.log('[Debug] Attempting curl approach...');
    let attendanceData = null;
    let pullMethod = 'unknown';

    const curlResult = await pullHikvisionDataWithCurl(startDate, endDate);
    if (curlResult.success && curlResult.data) {
      attendanceData = curlResult.data;
      pullMethod = 'curl';
      console.log('[Debug] Successfully pulled data using curl');
    } else {
      console.log('[Debug] Curl approach failed:', curlResult.error);
      
      // Fallback to fetch approach
      console.log('[Debug] Attempting fetch approach...');
      const fetchResult = await pullHikvisionDataWithFetch(startDate, endDate);
      if (fetchResult.success && fetchResult.data) {
        attendanceData = fetchResult.data;
        pullMethod = 'fetch';
        console.log('[Debug] Successfully pulled data using fetch');
      } else {
        console.log('[Debug] Fetch approach failed:', fetchResult.error);
        
        // Final fallback to original client
        console.log('[Debug] Attempting original Hikvision client...');
        const hikvisionClient = new HikvisionClient();
        attendanceData = await hikvisionClient.pullAttendanceData(startDate, endDate);
        if (attendanceData) {
          pullMethod = 'hikvision-client';
          console.log('[Debug] Successfully pulled data using Hikvision client');
        }
      }
    }

    if (!attendanceData) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve data from Hikvision API using all methods (curl, fetch, client)'
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
        pullMethod: pullMethod,
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
          console.log('[Debug Process] Skipping event with no employee number. Event details:', {
          time: event.time,
          eventType: event.eventType,
          majorEventType: event.majorEventType,
          subEventType: event.subEventType,
          name: event.name,
          employeeNoString: event.employeeNoString
        });
          results.errors.push('Event with no employee number found');
          continue;
        }
        
        // Find employee by fingerprint ID
        let employee = await prisma.employee.findFirst({
          where: {
            fingerprintId: employeeNo
          }
        });
        
        if (!employee) {
          console.log(`[Debug Process] Employee not found for fingerprint ID: ${employeeNo}, creating new employee...`);
          
          // Auto-create employee from Hikvision data (minimal data only)
          const config = getHikvisionConfig();
          const employeeName = sanitizeEmployeeName(event.name, employeeNo);
          
          try {
            employee = await prisma.employee.create({
              data: {
                name: employeeName,
                // email is optional, so we don't include it
                position: config.position,
                fingerprintId: employeeNo,
                // hourlyRate and paymentBasis will use schema defaults (0 and "Daily")
              }
            });
            
            console.log(`[Debug Process] Auto-created employee: ${employee.name} (ID: ${employee.id}) for fingerprint ID: ${employeeNo}`);
            results.employeesAutoCreated++;
          } catch (createError) {
            console.error(`[Debug Process] Failed to create employee for fingerprint ID ${employeeNo}:`, createError);
            results.errors.push(`Failed to create employee for fingerprint ID ${employeeNo}: ${(createError as Error).message}`);
            results.employeesNotFound.push(employeeNo);
            continue;
          }
        }
        
        results.employeesMatched++;
        console.log(`[Debug Process] Processing event for employee: ${employee.name} at ${eventTime.toISOString()}`);
        
        // Get the date for grouping (no timezone adjustment - use the event time as-is for date)
        const eventDate = new Date(eventTime.toISOString().split('T')[0] + 'T00:00:00.000Z');
        
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