import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import HikvisionClient from '@/lib/hikvision-client';
import { pullHikvisionDataWithCurl, pullHikvisionDataWithFetch } from '@/lib/hikvision-curl';

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
      console.log('[Hikvision Webhook] Triggering attendance pull...');
      await pullAttendanceFromHikvision();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Event received, attendance pull triggered with 20k maxResults and 9-day range' 
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
    console.log('[Hikvision Pull] Starting attendance data pull triggered by event...');
    
    // Use the same comprehensive date range as the manual pull button
    // Import the timezone function here
    const { getNowInEgypt } = await import('@/lib/timezone');
    const todayEgypt = getNowInEgypt();
    
    // Start from 7 days ago at midnight, end tomorrow at 23:59:59 (same as UI)
    const startDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() - 7, 0, 0, 0);
    const endDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() + 1, 23, 59, 59);
    
    console.log('[Hikvision Pull] Using date range:', {
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
    
    // Process the attendance data using the shared service for consistency
    const { pullAndProcessAttendanceData } = await import('@/lib/attendance-pull-service');
    const result = await pullAndProcessAttendanceData(startDate, endDate);
    
    if (result.success && result.data) {
      console.log('[Hikvision Pull] Processing completed:', {
        eventsProcessed: result.data.processedResults.eventsProcessed,
        attendanceRecordsCreated: result.data.processedResults.attendanceRecordsCreated,
        attendanceRecordsUpdated: result.data.processedResults.attendanceRecordsUpdated
      });
    } else {
      console.error('[Hikvision Pull] Processing failed:', result.error);
    }
    
  } catch (error) {
    console.error('[Hikvision Pull] Error pulling attendance data:', error);
  } finally {
    // Reset rate limiting flag
    isCurrentlyPulling = false;
    console.log('[Hikvision Pull] Attendance pull completed, ready for next event');
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
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // If forceRefresh is requested, pull fresh data from Hikvision
    if (forceRefresh) {
      console.log('[API GET /api/attendance] Force refresh requested, pulling fresh data...');
      await pullAttendanceFromHikvision();
    }
    
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