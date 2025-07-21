import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[Test Webhook] Received test webhook request');
    
    // Parse the form data from Hikvision
    const formData = await request.formData();
    const eventLog = formData.get('event_log') as string;
    
    if (!eventLog) {
      console.log('[Test Webhook] No event_log found in form data');
      return NextResponse.json({ 
        success: false, 
        error: 'No event_log provided' 
      });
    }
    
    try {
      const eventData = JSON.parse(eventLog);
      console.log('[Test Webhook] Parsed event data:', {
        eventType: eventData.eventType,
        dateTime: eventData.dateTime,
        deviceIp: eventData.ipAddress,
        employeeName: eventData.AccessControllerEvent?.name,
        employeeNo: eventData.AccessControllerEvent?.employeeNoString,
        fullEvent: eventData
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test webhook received successfully',
        data: eventData
      });
      
    } catch (parseError) {
      console.error('[Test Webhook] Error parsing event data:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to parse event data',
        details: parseError
      });
    }
    
  } catch (error) {
    console.error('[Test Webhook] Error processing test request:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process test webhook' 
    }, { status: 500 });
  }
} 