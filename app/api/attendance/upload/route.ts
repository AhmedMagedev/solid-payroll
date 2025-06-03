import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Check for authentication
    let token = request.cookies.get('auth_token')?.value;
    
    // Check Authorization header if no cookie token
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    console.log(`[API Upload] Token check: ${token ? 'found' : 'not found'}`);
    console.log(`[API Upload] All cookies:`, JSON.stringify(Array.from(request.cookies.getAll())));
    
    if (!token) {
      console.log('[API] Upload attempt without authentication');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      console.log('[API] Upload attempt with invalid token');
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    // Fetch system settings for grace period calculation
    const systemSettings = await prisma.systemSettings.findFirst();
    const lateAllowanceMinutes = systemSettings?.lateAllowanceMinutes || 15;
    const workingHoursStart = systemSettings?.workingHoursStart || "09:00";

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
    const recordsByEmployeeAndDay = new Map<string, { records: string[], deviceId: string, date: string }>();

    // Parse each line of the file
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      
      if (parts.length < 3) {
        console.log(`[Parse] Skipping invalid line (insufficient parts): ${line}`);
        continue; // Skip invalid lines
      }
      
      const deviceId = parts[0]; // This is the fingerprint/device ID, not employee ID
      if (!deviceId) continue;
      
      const timestampStr = `${parts[1]} ${parts[2]}`;
      
      // Parse timestamp correctly to avoid timezone issues
      // Split the timestamp into components
      const [datePart, timePart] = timestampStr.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split(':').map(Number);
      
      // Create date object with explicit local time components
      const timestamp = new Date(year, month - 1, day, hours, minutes, seconds || 0);
      
      if (isNaN(timestamp.getTime())) {
        console.log(`[Parse] Invalid timestamp: ${timestampStr} from line: ${line}`);
        continue;
      }
      
      console.log(`[Parse] Device ID: ${deviceId}, Original: ${timestampStr} -> Parsed: ${timestamp.toLocaleString()}`);
      
      const dateStr = timestamp.toISOString().split('T')[0];
      const key = `${deviceId}-${dateStr}`;
      
      if (!recordsByEmployeeAndDay.has(key)) {
        recordsByEmployeeAndDay.set(key, {
          records: [],
          deviceId,
          date: dateStr
        });
      }
      
      // Store the actual timestamp object instead of string
      recordsByEmployeeAndDay.get(key)!.records.push(timestamp.toISOString());
    }

    // Helper function to check if check-in is beyond grace period
    function isCheckInBeyondGracePeriod(checkInTime: Date): boolean {
      try {
        // Parse working hours start time
        const [hours, minutes] = workingHoursStart.split(':');
        
        // Get the check-in date in local time
        const checkInDate = new Date(checkInTime);
        
        // Create the grace end time for the same day as check-in
        const graceEndTime = new Date(checkInDate);
        graceEndTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
        
        console.log(`[Grace Period Check] CheckIn: ${checkInDate.toLocaleString()}, GraceEnd: ${graceEndTime.toLocaleString()}, Late: ${checkInDate > graceEndTime}`);
        
        return checkInDate > graceEndTime;
      } catch (error) {
        console.error('Error in grace period calculation:', error);
        return false;
      }
    }

    const attendanceRecords = [];

    // Process each employee's daily records
    for (const { records, deviceId, date } of recordsByEmployeeAndDay.values()) {
      if (records.length === 0) continue;
      
      console.log(`[Process] Processing ${records.length} records for device ${deviceId} on ${date}`);
      
      // Sort records by timestamp (they're now ISO strings)
      records.sort();
      
      const checkIn = new Date(records[0]);
      const checkOut = records.length > 1 ? new Date(records[records.length - 1]) : null;
      
      console.log(`[Process] Device ${deviceId}: CheckIn=${checkIn.toLocaleString()}, CheckOut=${checkOut ? checkOut.toLocaleString() : 'None'}`);
      
      let hoursWorked = null;
      if (checkOut) {
        const diffMs = checkOut.getTime() - checkIn.getTime();
        hoursWorked = diffMs / (1000 * 60 * 60); // Convert ms to hours
        console.log(`[Process] Device ${deviceId}: Hours worked = ${hoursWorked.toFixed(2)}`);
      }

      // Determine if this day should be paid (false if late beyond grace period)
      const isPaidDay = !isCheckInBeyondGracePeriod(checkIn);
      console.log(`[Process] Device ${deviceId}: isPaidDay = ${isPaidDay}`);

      // Check if the employee exists by fingerprint ID
      const employee = await prisma.employee.findFirst({
        where: { fingerprintId: deviceId }
      });

      if (!employee) {
        console.log(`[API Upload] Employee with device ID '${deviceId}' not found, skipping record`);
        continue; // Skip if employee doesn't exist
      }

      console.log(`[Process] Found employee: ${employee.name} (ID: ${employee.id}) for device ${deviceId}`);

      // Create or update attendance record
      try {
        const attendance = await prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: new Date(date)
            }
          },
          update: {
            checkIn,
            checkOut,
            hoursWorked,
            isPaidDay
          },
          create: {
            employeeId: employee.id,
            date: new Date(date),
            checkIn,
            checkOut,
            hoursWorked,
            isPaidDay
          }
        });

        console.log(`[Process] Saved attendance for ${employee.name}: CheckIn=${attendance.checkIn?.toLocaleString()}, CheckOut=${attendance.checkOut?.toLocaleString()}`);
        attendanceRecords.push(attendance);
      } catch (err) {
        console.error(`Error processing record for employee ${deviceId} on ${date}:`, err);
      }
    }

    // Auto-calculate payouts for affected employees
    console.log('[API Upload] Starting automatic payout calculation...');
    
    // Get unique employee IDs from processed attendance records
    const affectedEmployeeIds = [...new Set(attendanceRecords.map(record => record.employeeId))];
    console.log(`[API Upload] Auto-calculating payouts for ${affectedEmployeeIds.length} employees`);
    
    let payoutsCreated = 0;
    let payoutsUpdated = 0;
    
    for (const employeeId of affectedEmployeeIds) {
      try {
        // Get employee details
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId }
        });
        
        if (!employee) continue;
        
        // Get all attendance records for this employee
        const allAttendance = await prisma.attendance.findMany({
          where: { employeeId },
          orderBy: { date: 'asc' }
        });
        
        if (allAttendance.length === 0) continue;
        
        // Group attendance by month (for monthly payment basis)
        const attendanceByMonth = new Map<string, typeof allAttendance>();
        
        allAttendance.forEach(record => {
          const date = new Date(record.date);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          
          if (!attendanceByMonth.has(monthKey)) {
            attendanceByMonth.set(monthKey, []);
          }
          attendanceByMonth.get(monthKey)!.push(record);
        });
        
        // Process each month
        for (const [monthKey, monthAttendance] of attendanceByMonth) {
          const [year, month] = monthKey.split('-').map(Number);
          const periodStart = new Date(year, month - 1, 1);
          const periodEnd = new Date(year, month, 0); // Last day of month
          
          // Check if payout already exists
          const existingPayout = await prisma.payout.findUnique({
            where: {
              employeeId_periodStart_periodEnd: {
                employeeId,
                periodStart,
                periodEnd
              }
            }
          });
          
          // Calculate payout - only count days where isPaidDay is true
          const paidDays = monthAttendance.filter(record => record.isPaidDay);
          const daysWorked = paidDays.length;
          const totalHours = paidDays.reduce((sum, record) => sum + (record.hoursWorked || 0), 0);
          const calculatedAmount = daysWorked * employee.dailyRate;
          
          if (existingPayout) {
            // Update existing payout if amount changed
            if (existingPayout.amount !== calculatedAmount) {
              await prisma.payout.update({
                where: { id: existingPayout.id },
                data: { 
                  amount: calculatedAmount,
                  comment: `Auto-updated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours (${monthAttendance.length - daysWorked} unpaid days)`,
                  updatedAt: new Date()
                }
              });
              payoutsUpdated++;
              console.log(`[API Upload] Updated payout for ${employee.name} (${monthKey}): ${calculatedAmount}`);
            }
          } else {
            // Create new payout
            await prisma.payout.create({
              data: {
                employeeId,
                periodStart,
                periodEnd,
                amount: calculatedAmount,
                isPaid: false,
                comment: `Auto-calculated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours (${monthAttendance.length - daysWorked} unpaid days)`
              }
            });
            payoutsCreated++;
            console.log(`[API Upload] Created payout for ${employee.name} (${monthKey}): ${calculatedAmount}`);
          }
        }
      } catch (payoutError) {
        console.error(`[API Upload] Error calculating payouts for employee ${employeeId}:`, payoutError);
        // Continue processing other employees even if one fails
      }
    }
    
    console.log(`[API Upload] Payout calculation completed. Created: ${payoutsCreated}, Updated: ${payoutsUpdated}`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${attendanceRecords.length} attendance records and updated payouts.`,
      recordsCount: attendanceRecords.length,
      payouts: {
        created: payoutsCreated,
        updated: payoutsUpdated,
        total: payoutsCreated + payoutsUpdated
      }
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