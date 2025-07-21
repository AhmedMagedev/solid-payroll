import { NextRequest, NextResponse } from 'next/server';

// Test endpoint for event-hook - NO AUTHENTICATION REQUIRED
export async function POST(request: NextRequest) {
  try {
    console.log('[Event Hook Test] Received test event alarm');
    
    // Parse the multipart/form-data from Hikvision
    const formData = await request.formData();
    const eventLog = formData.get('event_log') as string;
    
    if (!eventLog) {
      console.log('[Event Hook Test] No event_log found in form data');
      return NextResponse.json({ 
        success: false, 
        error: 'No event_log provided' 
      });
    }
    
    try {
      const eventData = JSON.parse(eventLog);
      console.log('[Event Hook Test] Test event parsed successfully:', {
        eventType: eventData.eventType,
        dateTime: eventData.dateTime,
        deviceIp: eventData.ipAddress,
        employeeName: eventData.AccessControllerEvent?.name,
        employeeNo: eventData.AccessControllerEvent?.employeeNoString,
        subEventType: eventData.AccessControllerEvent?.subEventType,
        verifyMode: eventData.AccessControllerEvent?.currentVerifyMode
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test event alarm received and parsed successfully',
        data: {
          eventType: eventData.eventType,
          dateTime: eventData.dateTime,
          deviceIp: eventData.ipAddress,
          employee: {
            name: eventData.AccessControllerEvent?.name,
            id: eventData.AccessControllerEvent?.employeeNoString
          },
          eventDetails: {
            subEventType: eventData.AccessControllerEvent?.subEventType,
            verifyMode: eventData.AccessControllerEvent?.currentVerifyMode,
            cardReaderNo: eventData.AccessControllerEvent?.cardReaderNo,
            doorNo: eventData.AccessControllerEvent?.doorNo
          }
        }
      });
      
    } catch (parseError) {
      console.error('[Event Hook Test] Error parsing event data:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to parse event data',
        details: parseError 
      });
    }
    
  } catch (error) {
    console.error('[Event Hook Test] Error processing test request:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process test event hook' 
    }, { status: 500 });
  }
} 