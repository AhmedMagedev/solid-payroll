import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import HikvisionClient from '@/lib/hikvision-client';
import { pullHikvisionDataWithCurl, pullHikvisionDataWithFetch } from '@/lib/hikvision-curl';
import { getHikvisionConfig, sanitizeEmployeeName } from '@/lib/hikvision-config';

// Rate limiting: prevent multiple simultaneous pulls
let isCurrentlyPulling = false;
let lastPullTime = 0;
const PULL_COOLDOWN_MS = 30000; // 30 seconds minimum between pulls

interface DateFilter {
  gte?: Date;
  lte?: Date;
}

interface AttendanceWhereClause {
  employeeId?: number;
  date?: DateFilter;
  employee?: {
    name?: {
      contains: string;
      mode: 'insensitive';
    };
  };
}

// Hikvision webhook handler
export async function POST(request: NextRequest) {
  try {
    console.log('[Hikvision Webhook] Received attendance event');
    
    // Parse the form data from Hikvision
    const formData = await request.formData();
    const eventLog = formData.get('event_log') as string;
    
    if (!eventLog) {
      console.log('[Hikvision Webhook] No event_log found in form data');
      return NextResponse.json({ success: true, message: 'No event data' });
    }
    
    try {
      const eventData = JSON.parse(eventLog);
      console.log('[Hikvision Webhook] Event received:', {
        eventType: eventData.eventType,
        dateTime: eventData.dateTime,
        deviceIp: eventData.ipAddress,
        employeeName: eventData.AccessControllerEvent?.name,
        employeeNo: eventData.AccessControllerEvent?.employeeNoString,
        rawEventData: eventData // Log full event for debugging
      });
      
      // Check rate limiting before triggering pull
      const now = Date.now();
      if (isCurrentlyPulling) {
        console.log('[Hikvision Webhook] Pull already in progress, skipping this event');
        return NextResponse.json({ 
          success: true, 
          message: 'Event received, but pull already in progress' 
        });
      }
      
      if (now - lastPullTime < PULL_COOLDOWN_MS) {
        console.log('[Hikvision Webhook] Too soon since last pull, skipping this event');
        return NextResponse.json({ 
          success: true, 
          message: 'Event received, but too soon since last pull' 
        });
      }
      
      // Trigger comprehensive attendance pull with increased maxResults and better date range
      console.log('[Hikvision Webhook] Triggering comprehensive attendance pull...');
      await pullAttendanceFromHikvision();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Event received, comprehensive attendance pull triggered with 20k maxResults and 9-day range' 
      });
      
    } catch (parseError) {
      console.error('[Hikvision Webhook] Error parsing event data:', parseError);
      return NextResponse.json({ 
        success: true, 
        message: 'Event received but could not parse data' 
      });
    }
    
  } catch (error) {
    console.error('[Hikvision Webhook] Error processing request:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process webhook' 
    }, { status: 500 });
  }
}

// Function to pull attendance data from Hikvision
async function pullAttendanceFromHikvision() {
  // Set rate limiting flags
  isCurrentlyPulling = true;
  lastPullTime = Date.now();
  
  try {
    console.log('[Hikvision Pull] Starting comprehensive attendance data pull triggered by event...');
    
    // Use the same comprehensive date range as the manual pull button
    // Import the timezone function here
    const { getNowInEgypt } = await import('@/lib/timezone');
    const todayEgypt = getNowInEgypt();
    
    // Start from 7 days ago at midnight, end tomorrow at 23:59:59 (same as UI)
    const startDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() - 7, 0, 0, 0);
    const endDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() + 1, 23, 59, 59);
    
    console.log('[Hikvision Pull] Using comprehensive date range:', {
      egyptTime: todayEgypt.toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      maxResults: '20000 (increased for comprehensive pull)'
    });
    
    // Try curl approach first (most reliable)
    console.log('[Hikvision Pull] Attempting curl approach...');
    let attendanceData = null;

    const curlResult = await pullHikvisionDataWithCurl(startDate, endDate);
    if (curlResult.success && curlResult.data) {
      attendanceData = curlResult.data;
      console.log('[Hikvision Pull] Successfully pulled data using curl');
    } else {
      console.log('[Hikvision Pull] Curl approach failed:', curlResult.error);
      
      // Fallback to fetch approach
      console.log('[Hikvision Pull] Attempting fetch approach...');
      const fetchResult = await pullHikvisionDataWithFetch(startDate, endDate);
      if (fetchResult.success && fetchResult.data) {
        attendanceData = fetchResult.data;
        console.log('[Hikvision Pull] Successfully pulled data using fetch');
      } else {
        console.log('[Hikvision Pull] Fetch approach failed:', fetchResult.error);
        
        // Final fallback to original client
        console.log('[Hikvision Pull] Attempting original Hikvision client...');
        const hikvisionClient = new HikvisionClient();
        attendanceData = await hikvisionClient.pullAttendanceData(startDate, endDate);
        if (attendanceData) {
          console.log('[Hikvision Pull] Successfully pulled data using Hikvision client');
        }
      }
    }
    
    if (!attendanceData) {
      console.error('[Hikvision Pull] Failed to retrieve attendance data using all methods');
      return;
    }
    
    console.log('[Hikvision Pull] Received data:', attendanceData);
    
    // Process the attendance data
    await processHikvisionAttendanceData(attendanceData);
    
  } catch (error) {
    console.error('[Hikvision Pull] Error pulling attendance data:', error);
  } finally {
    // Reset rate limiting flag
    isCurrentlyPulling = false;
    console.log('[Hikvision Pull] Attendance pull completed, ready for next event');
  }
}

// Function to process Hikvision attendance data and save to database
async function processHikvisionAttendanceData(data: { AcsEvent?: { InfoList?: Array<{ employeeNoString?: string; time: string; eventType?: string; majorEventType?: number; subEventType?: number; name?: string }> } }) {
  try {
    console.log('[Hikvision Process] Processing attendance data...');
    
    if (!data.AcsEvent || !data.AcsEvent.InfoList) {
      console.log('[Hikvision Process] No attendance events found in response');
      return;
    }
    
    const events = data.AcsEvent.InfoList;
    console.log(`[Hikvision Process] Found ${events.length} attendance events`);
    
    let processedCount = 0;
    
    for (const event of events) {
      try {
        // Extract data from event
        const employeeNo = event.employeeNoString;
        const eventTime = new Date(event.time);
        // Note: eventType might be used in future for determining check-in vs check-out
        
        if (!employeeNo) {
          console.log('[Hikvision Process] Skipping event with no employee number');
          continue;
        }
        
        // Find employee by fingerprint ID
        let employee = await prisma.employee.findFirst({
          where: {
            fingerprintId: employeeNo
          }
        });
        
        if (!employee) {
          console.log(`[Hikvision Process] Employee not found for fingerprint ID: ${employeeNo}, creating new employee...`);
          
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
            
            console.log(`[Hikvision Process] Auto-created employee: ${employee.name} (ID: ${employee.id}) for fingerprint ID: ${employeeNo}`);
          } catch (createError) {
            console.error(`[Hikvision Process] Failed to create employee for fingerprint ID ${employeeNo}:`, createError);
            continue;
          }
        }
        
        console.log(`[Hikvision Process] Processing event for employee: ${employee.name} at ${eventTime.toISOString()}`);
        
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
          // Determine if this should be check-in or check-out based on time
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
            console.log(`[Hikvision Process] Updated attendance for ${employee.name} on ${eventDate.toDateString()}`);
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
          console.log(`[Hikvision Process] Created new attendance for ${employee.name} on ${eventDate.toDateString()}`);
        }
        
        processedCount++;
        
      } catch (eventError) {
        console.error('[Hikvision Process] Error processing individual event:', eventError);
      }
    }
    
    console.log(`[Hikvision Process] Successfully processed ${processedCount} attendance events`);
    
  } catch (error) {
    console.error('[Hikvision Process] Error processing attendance data:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search'); // New search parameter
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build the where clause for filtering
    const where: AttendanceWhereClause = {};
    
    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }
    
    if (startDate || endDate) {
      where.date = {};
      
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }
    
    // Add employee name search if provided
    if (search) {
      where.employee = {
        name: {
          contains: search,
          mode: 'insensitive' as const
        }
      };
    }
    
    // Get total count for pagination
    const totalCount = await prisma.attendance.count({
      where
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Fetch attendance records with pagination
    const attendanceRecords = await prisma.attendance.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
        penalties: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      skip: offset,
      take: limit,
    });
    
    // Format the response with backend penalties only
    const formattedRecords = attendanceRecords.map(record => {
      const checkInStr = record.checkIn ? record.checkIn.toISOString() : null;
      const checkOutStr = record.checkOut ? record.checkOut.toISOString() : null;
      
      // Use only backend penalties from database
      const penalties = record.penalties
        .filter(p => !p.isWaived) // Only show active, non-waived penalties
        .map(p => ({
          type: p.penaltyType.toLowerCase().replace('_', '-'),
          label: p.description,
          color: getSeverityColor(p.severity),
        }));
      
      return {
        ...record,
        date: record.date.toISOString().split('T')[0],
        checkIn: checkInStr,
        checkOut: checkOutStr,
        penalties
      };
    });
    
    return NextResponse.json({
      data: formattedRecords,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, totalCount)
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching attendance records:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch attendance records', details: errorMessage },
      { status: 500 }
    );
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'MINOR':
      return 'bg-yellow-100 text-yellow-800';
    case 'MODERATE':
      return 'bg-orange-100 text-orange-800';
    case 'MAJOR':
      return 'bg-purple-100 text-purple-800';
    case 'FULL_DAY':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
} 