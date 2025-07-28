import { NextRequest, NextResponse } from 'next/server';

// Rate limiting: prevent multiple simultaneous pulls
let isCurrentlyPulling = false;
let lastPullTime = 0;
const PULL_COOLDOWN_MS = 30000; // 30 seconds minimum between pulls

// Cron job handler for periodic attendance pulls
export async function GET(request: NextRequest) {
  try {
    console.log('⏰ Cron Job Triggered');

    // Check rate limiting before triggering pull
    const now = Date.now();
    if (isCurrentlyPulling) {
      console.log('[Cron Job] Pull already in progress, skipping this run');
      return NextResponse.json({ 
        success: true, 
        message: 'Pull already in rogress' 
      });
    }
    
    if (now - lastPullTime < PULL_COOLDOWN_MS) {
      console.log('[Cron Job] Too soon since last pull, skipping this run');
      return NextResponse.json({ 
        success: true, 
        message: 'Too soon since last pull' 
      });
    }

    // Trigger comprehensive attendance pull
    console.log('[Cron Job] Triggering comprehensive attendance pull...');
    await pullAttendanceFromHikvision();
    console.log('[Cron Job] Attendance pull completed, UI will auto-refresh within 30 seconds');

    return NextResponse.json({ 
      success: true, 
      message: 'Comprehensive attendance pull triggered successfully' 
    });

  } catch (error) {
    console.error('[Cron Job] Error processing request:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process cron job' 
    }, { status: 500 });
  }
}

// Function to pull attendance data from Hikvision (uses shared service)
async function pullAttendanceFromHikvision() {
  // Set rate limiting flags
  isCurrentlyPulling = true;
  lastPullTime = Date.now();
  
  try {
    console.log('[Cron Job] Starting comprehensive attendance data pull...');
    
    // Use the same comprehensive date range as the manual pull button
    const { getNowInEgypt } = await import('@/lib/timezone');
    const todayEgypt = getNowInEgypt();
    
    // Start from 7 days ago at midnight, end tomorrow at 23:59:59 (same as UI)
    const startDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() - 7, 0, 0, 0);
    const endDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() + 1, 23, 59, 59);
    
    console.log('[Cron Job] Using comprehensive date range:', {
      egyptTime: todayEgypt.toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      maxResults: '20000 (same as manual pull)'
    });
    
    // Use the shared attendance pull service to ensure consistency with manual pull
    const { pullAndProcessAttendanceData } = await import('@/lib/attendance-pull-service');
    const result = await pullAndProcessAttendanceData(startDate, endDate);
    
    if (result.success && result.data) {
      console.log('[Cron Job] Attendance pull completed successfully:', {
        pullMethod: result.data.pullMethod,
        eventsProcessed: result.data.processedResults.eventsProcessed,
        employeesMatched: result.data.processedResults.employeesMatched,
        employeesAutoCreated: result.data.processedResults.employeesAutoCreated,
        attendanceRecordsCreated: result.data.processedResults.attendanceRecordsCreated,
        attendanceRecordsUpdated: result.data.processedResults.attendanceRecordsUpdated,
        errors: result.data.processedResults.errors.length
      });
    } else {
      console.error('[Cron Job] Attendance pull failed:', result.error);
    }
    
  } catch (error) {
    console.error('[Cron Job] Error pulling attendance data:', error);
  } finally {
    // Reset rate limiting flag
    isCurrentlyPulling = false;
    console.log('[Cron Job] Attendance pull completed, ready for next run');
  }
} 