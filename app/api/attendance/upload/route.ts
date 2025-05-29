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

    // Helper function to check if check-in is beyond grace period
    function isCheckInBeyondGracePeriod(checkInTime: Date): boolean {
      try {
        // Parse working hours start time
        const [hours, minutes] = workingHoursStart.split(':');
        
        // Create grace end time in local timezone (UTC+3)
        // Convert checkInTime to local time for comparison
        const localCheckIn = new Date(checkInTime.getTime() + (3 * 60 * 60 * 1000)); // Add 3 hours for UTC+3
        
        // Create grace end time for the same day in local timezone
        const graceEndTime = new Date(localCheckIn);
        graceEndTime.setUTCHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
        
        return localCheckIn > graceEndTime;
      } catch {
        return false;
      }
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

      // Determine if this day should be paid (false if late beyond grace period)
      const isPaidDay = !isCheckInBeyondGracePeriod(checkIn);

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
            hoursWorked,
            isPaidDay
          },
          create: {
            employeeId,
            date: new Date(date),
            checkIn,
            checkOut,
            hoursWorked,
            isPaidDay
          }
        });

        attendanceRecords.push(attendance);
      } catch (err) {
        console.error(`Error processing record for employee ${employeeId} on ${date}:`, err);
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