import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';

const prisma = new PrismaClient();

// GET system settings
export async function GET(request: NextRequest) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }
    // Get the first (and only) settings record, or create it if it doesn't exist
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.systemSettings.create({
        data: {} // Use schema defaults
      });
    }
    
    return NextResponse.json(settings);
  } catch (error: unknown) {
    console.error('Error fetching settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: errorMessage },
      { status: 500 }
    );
  }
}

// Update system settings
export async function PUT(request: NextRequest) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }
    
    const data = await request.json();
    
    // Get existing settings or create default
    const existingSettings = await prisma.systemSettings.findFirst();
    
    // Check if grace period or working hours are being changed
    const isGracePeriodChanged = data.lateAllowanceMinutes !== undefined && 
      existingSettings && data.lateAllowanceMinutes !== existingSettings.lateAllowanceMinutes;
    const isWorkingHoursChanged = data.workingHoursStart !== undefined && 
      existingSettings && data.workingHoursStart !== existingSettings.workingHoursStart;
    
    let settings;
    
    if (existingSettings) {
      // Update existing settings
      settings = await prisma.systemSettings.update({
        where: { id: existingSettings.id },
        data: {
          lateAllowanceMinutes: data.lateAllowanceMinutes !== undefined ? 
            parseInt(data.lateAllowanceMinutes) : undefined,
          workDaySunday: data.workDaySunday !== undefined ? 
            Boolean(data.workDaySunday) : undefined,
          workDayMonday: data.workDayMonday !== undefined ? 
            Boolean(data.workDayMonday) : undefined,
          workDayTuesday: data.workDayTuesday !== undefined ? 
            Boolean(data.workDayTuesday) : undefined,
          workDayWednesday: data.workDayWednesday !== undefined ? 
            Boolean(data.workDayWednesday) : undefined,
          workDayThursday: data.workDayThursday !== undefined ? 
            Boolean(data.workDayThursday) : undefined,
          workDayFriday: data.workDayFriday !== undefined ? 
            Boolean(data.workDayFriday) : undefined,
          workDaySaturday: data.workDaySaturday !== undefined ? 
            Boolean(data.workDaySaturday) : undefined,
          workingHoursPerDay: data.workingHoursPerDay !== undefined ? 
            parseFloat(data.workingHoursPerDay) : undefined,
          workingHoursStart: data.workingHoursStart || undefined,
          workingHoursEnd: data.workingHoursEnd || undefined,
          overtimeMultiplier: data.overtimeMultiplier !== undefined ? 
            parseFloat(data.overtimeMultiplier) : undefined,
          weekendOvertimeMultiplier: data.weekendOvertimeMultiplier !== undefined ? 
            parseFloat(data.weekendOvertimeMultiplier) : undefined,
        },
      });
    } else {
      // Create new settings
      settings = await prisma.systemSettings.create({
        data: {
          lateAllowanceMinutes: data.lateAllowanceMinutes !== undefined ? 
            parseInt(data.lateAllowanceMinutes) : 15,
          workDaySunday: data.workDaySunday !== undefined ? 
            Boolean(data.workDaySunday) : false,
          workDayMonday: data.workDayMonday !== undefined ? 
            Boolean(data.workDayMonday) : true,
          workDayTuesday: data.workDayTuesday !== undefined ? 
            Boolean(data.workDayTuesday) : true,
          workDayWednesday: data.workDayWednesday !== undefined ? 
            Boolean(data.workDayWednesday) : true,
          workDayThursday: data.workDayThursday !== undefined ? 
            Boolean(data.workDayThursday) : true,
          workDayFriday: data.workDayFriday !== undefined ? 
            Boolean(data.workDayFriday) : true,
          workDaySaturday: data.workDaySaturday !== undefined ? 
            Boolean(data.workDaySaturday) : false,
          workingHoursPerDay: data.workingHoursPerDay !== undefined ? 
            parseFloat(data.workingHoursPerDay) : 8,
          workingHoursStart: data.workingHoursStart || "09:00",
          workingHoursEnd: data.workingHoursEnd || "17:00",
          overtimeMultiplier: data.overtimeMultiplier !== undefined ? 
            parseFloat(data.overtimeMultiplier) : 1.5,
          weekendOvertimeMultiplier: data.weekendOvertimeMultiplier !== undefined ? 
            parseFloat(data.weekendOvertimeMultiplier) : 2,
        },
      });
    }

    // Auto-recalculate attendance if grace period or working hours changed
    let recalculationResult = null;
    if (isGracePeriodChanged || isWorkingHoursChanged) {
      console.log('[Settings Update] Grace period or working hours changed, triggering attendance recalculation...');
      
      try {
        recalculationResult = await recalculateAttendancePaidStatus(settings);
        console.log('[Settings Update] Attendance recalculation completed:', recalculationResult);
      } catch (recalcError) {
        console.error('[Settings Update] Error during attendance recalculation:', recalcError);
        // Don't fail the settings update if recalculation fails
      }
    }
    
    return NextResponse.json({
      message: 'Settings updated successfully',
      settings,
      recalculation: recalculationResult
    });
  } catch (error: unknown) {
    console.error('Error updating settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update settings', details: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to recalculate attendance paid status
async function recalculateAttendancePaidStatus(systemSettings: {
  lateAllowanceMinutes?: number;
  workingHoursStart?: string;
}) {
  const lateAllowanceMinutes = systemSettings.lateAllowanceMinutes || 15;
  const workingHoursStart = systemSettings.workingHoursStart || "09:00";

  // Helper function to check if check-in is beyond grace period
  function isCheckInBeyondGracePeriod(checkInTime: Date): boolean {
    try {
      // Parse working hours start time
      const [hours, minutes] = workingHoursStart.split(':');
      
      // Convert stored UTC time back to local time (UTC+3) for comparison
      const timezoneOffset = 3 * 60; // UTC+3 in minutes
      const localCheckIn = new Date(checkInTime.getTime() + (timezoneOffset * 60 * 1000));
      
      // Create the grace end time for the same day as check-in in local time
      const graceEndTime = new Date(localCheckIn);
      graceEndTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
      
      console.log(`[Recalc Grace Check] CheckIn (Local): ${localCheckIn.toISOString()}, GraceEnd (Local): ${graceEndTime.toISOString()}, Late: ${localCheckIn > graceEndTime}`);
      
      return localCheckIn > graceEndTime;
    } catch {
      return false;
    }
  }

  // Get all attendance records
  const allAttendance = await prisma.attendance.findMany({
    orderBy: { date: 'desc' }
  });

  let updatedCount = 0;
  let paidToUnpaidCount = 0;

  // Process each attendance record
  for (const record of allAttendance) {
    const checkInTime = new Date(record.checkIn);
    
    // Determine if this day should be paid (false if late beyond grace period)
    const shouldBePaid = !isCheckInBeyondGracePeriod(checkInTime);
    const currentlyPaid = record.isPaidDay !== false; // Default to true if null/undefined
    
    // Only update if the status needs to change
    if (shouldBePaid !== currentlyPaid) {
      await prisma.attendance.update({
        where: { id: record.id },
        data: { isPaidDay: shouldBePaid }
      });
      
      updatedCount++;
      if (currentlyPaid && !shouldBePaid) {
        paidToUnpaidCount++;
      }
    }
  }

  // Recalculate payouts for affected employees if any records were updated
  let payoutsUpdated = 0;
  if (updatedCount > 0) {
    const affectedEmployees = [...new Set(allAttendance.map(record => record.employeeId))];
    
    for (const employeeId of affectedEmployees) {
      try {
        // Get employee details
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId }
        });
        
        if (!employee) continue;
        
        // Get all attendance records for this employee
        const employeeAttendance = await prisma.attendance.findMany({
          where: { employeeId },
          orderBy: { date: 'asc' }
        });
        
        if (employeeAttendance.length === 0) continue;
        
        // Group attendance by month (for monthly payment basis)
        const attendanceByMonth = new Map<string, typeof employeeAttendance>();
        
        employeeAttendance.forEach(record => {
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
          // FIXED: Create proper month boundaries - 1st to last day of each month
          const periodStart = new Date(year, month - 1, 1, 0, 0, 0, 0); // First day at 00:00:00
          const periodEnd = new Date(year, month, 0, 23, 59, 59, 999); // Last day at 23:59:59
          
          console.log(`[Settings Payout] ${monthKey}: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);
          
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
          
          if (existingPayout) {
            // Only count days where isPaidDay is true
            const paidDays = monthAttendance.filter(record => record.isPaidDay);
            const daysWorked = paidDays.length;
            const totalHours = paidDays.reduce((sum, record) => sum + (record.hoursWorked || 0), 0);
            
            // RESTORED OVERTIME CALCULATION with sophisticated rules
            const hoursPerDay = 9; // Standard working hours per day
            const hourlyRate = employee.dailyRate / hoursPerDay;
            const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
            
            let regularHours = 0;
            let overtimeHours = 0;
            let excessOvertimeHours = 0; // Hours beyond 2-hour overtime cap
            
            // Helper to get next working day (simplified - assumes Sun-Thu working days)
            const getNextWorkingDay = (date: Date) => {
              const nextDay = new Date(date);
              nextDay.setDate(nextDay.getDate() + 1);
              const dayOfWeek = nextDay.getDay();
              // Working days: Sunday(0), Monday(1), Tuesday(2), Wednesday(3), Thursday(4)
              // Friday(5) and Saturday(6) are off
              return (dayOfWeek >= 0 && dayOfWeek <= 4) ? nextDay : null;
            };
            
            // Calculate overtime per day with rules
            paidDays.forEach((record) => {
              const dailyHours = record.hoursWorked || 0;
              const recordDate = new Date(record.date);
              
              if (dailyHours > hoursPerDay) {
                const potentialOvertimeHours = dailyHours - hoursPerDay;
                
                // Check if employee must be present next working day for overtime eligibility
                const nextWorkingDay = getNextWorkingDay(recordDate);
                let isOvertimeEligible = true;
                
                if (nextWorkingDay) {
                  // Check if employee was present on the next working day
                  const nextDayAttendance = paidDays.find(a => {
                    const aDate = new Date(a.date);
                    return aDate.toDateString() === nextWorkingDay.toDateString();
                  });
                  
                  // If next working day exists and employee was not present, overtime is not eligible
                  if (!nextDayAttendance) {
                    isOvertimeEligible = false;
                  }
                }
                
                if (isOvertimeEligible) {
                  regularHours += hoursPerDay;
                  
                  // Apply 2-hour overtime cap rule
                  if (potentialOvertimeHours <= 2) {
                    // All overtime hours within cap - paid at overtime rate
                    overtimeHours += potentialOvertimeHours;
                  } else {
                    // First 2 hours at overtime rate, rest at regular rate
                    overtimeHours += 2;
                    excessOvertimeHours += (potentialOvertimeHours - 2);
                  }
                } else {
                  // Overtime not eligible, treat as regular hours up to standard hours
                  regularHours += Math.min(dailyHours, hoursPerDay);
                }
              } else {
                regularHours += dailyHours;
              }
            });
            
            // Include excess overtime hours in regular hours for payment calculation
            regularHours += excessOvertimeHours;
            
            // Calculate amounts
            const basePayout = daysWorked * employee.dailyRate;
            const overtimePayout = overtimeHours * overtimeRate;
            const calculatedAmount = basePayout + overtimePayout;

            // Update existing payout if amount changed
            await prisma.payout.update({
              where: { id: existingPayout.id },
              data: {
                amount: calculatedAmount,
                daysWorked,
                unpaidDays: monthAttendance.length - daysWorked,
                totalHours,
                regularHours,
                overtimeHours,
                excessOvertimeHours,
                basePayout,
                overtimePayout,
                finalAmount: calculatedAmount,
                updatedAt: new Date()
              }
            });
            payoutsUpdated++;
          }
        }
      } catch (payoutError) {
        console.error(`[Settings Recalculation] Error recalculating payouts for employee ${employeeId}:`, payoutError);
      }
    }
  }

  return {
    totalRecords: allAttendance.length,
    updatedRecords: updatedCount,
    paidToUnpaidTransitions: paidToUnpaidCount,
    payoutsUpdated
  };
} 