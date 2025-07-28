import HikvisionClient from '@/lib/hikvision-client';
import { pullHikvisionDataWithCurl, pullHikvisionDataWithFetch } from '@/lib/hikvision-curl';
import { prisma } from '@/app/lib/prisma';
import { getHikvisionConfig, sanitizeEmployeeName } from '@/lib/hikvision-config';
import { DateTime } from 'luxon';

export interface AttendancePullResult {
  success: boolean;
  error?: string;
  data?: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    pullMethod: string;
    hikvisionResponse: unknown;
    processedResults: {
      eventsProcessed: number;
      employeesMatched: number;
      employeesAutoCreated: number;
      employeesNotFound: string[];
      attendanceRecordsCreated: number;
      attendanceRecordsUpdated: number;
      errors: string[];
    };
  };
}

/**
 * Shared function to pull attendance data from Hikvision and process it
 * Used by both manual pull button and event hook to ensure consistency
 */
export async function pullAndProcessAttendanceData(startDate: Date, endDate: Date): Promise<AttendancePullResult> {
  try {
    console.log('[Attendance Pull Service] Starting attendance data pull...');
    console.log('[Attendance Pull Service] Date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Try curl approach first (most reliable)
    console.log('[Attendance Pull Service] Attempting curl approach...');
    let attendanceData = null;
    let pullMethod = 'unknown';

    const curlResult = await pullHikvisionDataWithCurl(startDate, endDate);
    if (curlResult.success && curlResult.data) {
      attendanceData = curlResult.data;
      pullMethod = 'curl';
      console.log('[Attendance Pull Service] Successfully pulled data using curl');
    } else {
      console.log('[Attendance Pull Service] Curl approach failed:', curlResult.error);
      
      // Fallback to fetch approach
      console.log('[Attendance Pull Service] Attempting fetch approach...');
      const fetchResult = await pullHikvisionDataWithFetch(startDate, endDate);
      if (fetchResult.success && fetchResult.data) {
        attendanceData = fetchResult.data;
        pullMethod = 'fetch';
        console.log('[Attendance Pull Service] Successfully pulled data using fetch');
      } else {
        console.log('[Attendance Pull Service] Fetch approach failed:', fetchResult.error);
        
        // Final fallback to original client
        console.log('[Attendance Pull Service] Attempting original Hikvision client...');
        const hikvisionClient = new HikvisionClient();
        attendanceData = await hikvisionClient.pullAttendanceData(startDate, endDate);
        if (attendanceData) {
          pullMethod = 'hikvision-client';
          console.log('[Attendance Pull Service] Successfully pulled data using Hikvision client');
        }
      }
    }

    if (!attendanceData) {
      return {
        success: false,
        error: 'Failed to retrieve data from Hikvision API using all methods (curl, fetch, client)'
      };
    }

    console.log('[Attendance Pull Service] Retrieved attendance data:', attendanceData);

    // Process the data
    const processedResults = await processHikvisionAttendanceData(attendanceData);

    return {
      success: true,
      data: {
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        pullMethod: pullMethod,
        hikvisionResponse: attendanceData,
        processedResults
      }
    };

  } catch (error) {
    console.error('[Attendance Pull Service] Error during pull:', error);
    return {
      success: false,
      error: `Pull service error: ${(error as Error).message}`
    };
  }
}

// Function to process Hikvision attendance data
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
    console.log('[Attendance Pull Service] Processing attendance data...');
    
    if (!data.AcsEvent || !data.AcsEvent.InfoList) {
      console.log('[Attendance Pull Service] No attendance events found in response');
      return results;
    }
    
    const events = data.AcsEvent.InfoList;
    console.log(`[Attendance Pull Service] Found ${events.length} attendance events`);
    
    for (const event of events) {
      try {
        results.eventsProcessed++;
        
        // Extract data from event
        const employeeNo = event.employeeNoString;
        const eventTime = DateTime.fromISO(event.time, { zone: 'utc' }).toJSDate();
        
        if (!employeeNo) {
          console.log('[Attendance Pull Service] Skipping event with no employee number. Event details:', {
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
          console.log(`[Attendance Pull Service] Employee not found for fingerprint ID: ${employeeNo}, creating new employee...`);
          
          // Auto-create employee from Hikvision data (minimal data only)
          const config = getHikvisionConfig();
          const employeeName = sanitizeEmployeeName(event.name, employeeNo);
          
          try {
            employee = await prisma.employee.create({
              data: {
                name: employeeName,
                position: config.position,
                fingerprintId: employeeNo,
              }
            });
            
            console.log(`[Attendance Pull Service] Auto-created employee: ${employee.name} (ID: ${employee.id}) for fingerprint ID: ${employeeNo}`);
            results.employeesAutoCreated++;
          } catch (createError) {
            console.error(`[Attendance Pull Service] Failed to create employee for fingerprint ID ${employeeNo}:`, createError);
            results.errors.push(`Failed to create employee for fingerprint ID ${employeeNo}: ${(createError as Error).message}`);
            results.employeesNotFound.push(employeeNo);
            continue;
          }
        }
        
        results.employeesMatched++;
        console.log(`[Attendance Pull Service] Processing event for employee: ${employee.name} at ${eventTime.toISOString()}`);
        
        // Get the date for grouping (use event time as-is without timezone adjustments)
        const eventDate = new Date(eventTime.getFullYear(), eventTime.getMonth(), eventTime.getDate(), 0, 0, 0, 0);
        
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
          
          const currentCheckIn = existingAttendance.checkIn;
          const currentCheckOut = existingAttendance.checkOut;

          if (!currentCheckIn) {
            updateData.checkIn = eventTime;
          } else if (eventTime < currentCheckIn) {
            updateData.checkIn = eventTime;
            if (!currentCheckOut || currentCheckIn > currentCheckOut) {
              updateData.checkOut = currentCheckIn;
            }
          } else if (!currentCheckOut) {
            if (eventTime > currentCheckIn) {
              updateData.checkOut = eventTime;
            }
          } else if (eventTime > currentCheckOut) {
            updateData.checkOut = eventTime;
          }

          // Recalculate hours worked if we have both check-in and check-out
          const newCheckIn = updateData.checkIn || currentCheckIn;
          const newCheckOut = updateData.checkOut || currentCheckOut;

          if (newCheckIn && newCheckOut && newCheckOut > newCheckIn) {
            const hours = (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60);
            updateData.hoursWorked = hours;
            updateData.actualHoursWorked = hours;
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
            console.log(`[Attendance Pull Service] Updated attendance for ${employee.name} on ${eventDate.toDateString()}`);
          }
        } else {
          // Create new attendance record
          await prisma.attendance.create({
            data: {
              employeeId: employee.id,
              date: eventDate,
              checkIn: eventTime,
              checkOut: null,
              hoursWorked: null,
              actualHoursWorked: 0,
              isPaidDay: true
            }
          });
          results.attendanceRecordsCreated++;
          console.log(`[Attendance Pull Service] Created new attendance for ${employee.name} on ${eventDate.toDateString()}`);
        }
        
      } catch (eventError) {
        console.error('[Attendance Pull Service] Error processing individual event:', eventError);
        results.errors.push(`Error processing event: ${(eventError as Error).message}`);
      }
    }
    
    console.log(`[Attendance Pull Service] Successfully processed ${results.eventsProcessed} events`);
    console.log(`[Attendance Pull Service] Results:`, {
      eventsProcessed: results.eventsProcessed,
      employeesMatched: results.employeesMatched,
      employeesAutoCreated: results.employeesAutoCreated,
      attendanceRecordsCreated: results.attendanceRecordsCreated,
      attendanceRecordsUpdated: results.attendanceRecordsUpdated,
      errors: results.errors.length
    });
    
    return results;
    
  } catch (error) {
    console.error('[Attendance Pull Service] Error processing attendance data:', error);
    results.errors.push(`Processing error: ${(error as Error).message}`);
    return results;
  }
} 