import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { parseISO, isWithinInterval, startOfWeek, endOfWeek, format, addWeeks } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('[Auto Calculate Payouts] Starting automatic payout calculation...');

    // Get all employees
    const employees = await prisma.employee.findMany();
    console.log(`[Auto Calculate Payouts] Found ${employees.length} employees`);

    let totalCreated = 0;
    let totalUpdated = 0;
    const results: Array<{
      employeeName: string;
      period: string;
      daysWorked: number;
      totalHours: number;
      amount: number;
      action: string;
    }> = [];

    for (const employee of employees) {
      console.log(`[Auto Calculate Payouts] Processing employee: ${employee.name}`);

      // Get all attendance records for this employee
      const attendance = await prisma.attendance.findMany({
        where: { employeeId: employee.id },
        orderBy: { date: 'asc' }
      });

      if (attendance.length === 0) {
        console.log(`[Auto Calculate Payouts] No attendance data for ${employee.name}, skipping`);
        continue;
      }

      // Calculate periods based on payment basis
      const periods = calculatePaymentPeriods(attendance, employee);
      
      for (const period of periods) {
        const { periodStart, periodEnd, label } = period;

        // Check if payout already exists for this period
        const existingPayout = await prisma.payout.findUnique({
          where: {
            employeeId_periodStart_periodEnd: {
              employeeId: employee.id,
              periodStart,
              periodEnd
            }
          }
        });

        // Calculate payout for this period - only count days where isPaidDay is true
        const periodAttendance = attendance.filter(record => {
          const recordDate = typeof record.date === 'string' ? parseISO(record.date) : new Date(record.date);
          return isWithinInterval(recordDate, { start: periodStart, end: periodEnd });
        });

        const paidDays = periodAttendance.filter(record => record.isPaidDay !== false); // Include records where isPaidDay is true or undefined (for backward compatibility)
        const daysWorked = paidDays.length;
        const totalHours = paidDays.reduce((sum, record) => sum + (record.hoursWorked || 0), 0);
        
        // RESTORED OVERTIME CALCULATION with sophisticated rules
        const hoursPerDay = 9; // Standard working hours per day
        const hourlyRate = employee.dailyRate / hoursPerDay;
        const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
        
        let regularHours = 0;
        let overtimeHours = 0;
        let excessOvertimeHours = 0; // Hours beyond 2-hour overtime cap
        
        console.log(`[Auto-Calc Overtime] Employee ${employee.name}, Period ${label}: Processing ${paidDays.length} paid days`);
        
        // Calculate overtime per day with rules
        paidDays.forEach((record, dayIndex) => {
          const dailyHours = record.hoursWorked || 0;
          const recordDate = typeof record.date === 'string' ? parseISO(record.date) : new Date(record.date);
          
          console.log(`[Auto-Calc Overtime] Day ${dayIndex + 1}: ${recordDate.toDateString()}, Hours: ${dailyHours}`);
          
          if (dailyHours > hoursPerDay) {
            const potentialOvertimeHours = dailyHours - hoursPerDay;
            console.log(`[Auto-Calc Overtime] Potential overtime: ${potentialOvertimeHours} hours`);
            
            // SIMPLIFIED: Remove next-day presence requirement for now to test
            const isOvertimeEligible = true;
            
            /* DISABLED FOR DEBUGGING
            // Check if employee must be present next working day for overtime eligibility
            const nextWorkingDay = getNextWorkingDay(recordDate);
            let isOvertimeEligible = true;
            
            if (nextWorkingDay) {
              // Check if employee was present on the next working day
              const nextDayAttendance = paidDays.find(a => {
                const aDate = typeof a.date === 'string' ? parseISO(a.date) : new Date(a.date);
                return aDate.toDateString() === nextWorkingDay.toDateString();
              });
              
              // If next working day exists and employee was not present, overtime is not eligible
              if (!nextDayAttendance) {
                isOvertimeEligible = false;
              }
            }
            */
            
            if (isOvertimeEligible) {
              regularHours += hoursPerDay;
              
              // Apply 2-hour overtime cap rule
              if (potentialOvertimeHours <= 2) {
                // All overtime hours within cap - paid at overtime rate
                overtimeHours += potentialOvertimeHours;
                console.log(`[Auto-Calc Overtime] Added ${potentialOvertimeHours} overtime hours (within cap)`);
              } else {
                // First 2 hours at overtime rate, rest at regular rate
                overtimeHours += 2;
                excessOvertimeHours += (potentialOvertimeHours - 2);
                console.log(`[Auto-Calc Overtime] Added 2 overtime hours + ${potentialOvertimeHours - 2} excess hours`);
              }
            } else {
              // Overtime not eligible, treat as regular hours up to standard hours
              regularHours += Math.min(dailyHours, hoursPerDay);
              console.log(`[Auto-Calc Overtime] Overtime not eligible - treating as regular hours`);
            }
          } else {
            regularHours += dailyHours;
            console.log(`[Auto-Calc Overtime] Regular day: ${dailyHours} hours`);
          }
        });
        
        // Include excess overtime hours in regular hours for payment calculation
        regularHours += excessOvertimeHours;
        
        console.log(`[Auto-Calc Overtime] Final totals - Regular: ${regularHours}, Overtime: ${overtimeHours}, Excess: ${excessOvertimeHours}`);
        
        // Calculate amounts
        const basePayout = daysWorked * employee.dailyRate;
        const excessOvertimePayout = excessOvertimeHours * hourlyRate; // Excess overtime at regular rate
        const overtimePayout = (overtimeHours * overtimeRate) + excessOvertimePayout; // Total overtime payment
        const calculatedAmount = basePayout + overtimePayout;
        
        // Set finalAmount to base payout only by default (overtime excluded unless explicitly enabled)
        // Users can toggle overtime inclusion later via the UI
        const finalAmount = basePayout; // Default: exclude overtime, user can enable it later
        
        console.log(`[Auto-Calc Overtime] Amounts - Base: ${basePayout}, Overtime (1.5x): ${(overtimeHours * overtimeRate).toFixed(2)}, Excess Overtime (regular): ${excessOvertimePayout.toFixed(2)}, Total Overtime: ${overtimePayout}, Total Available: ${calculatedAmount}, Final (default): ${finalAmount}`);

        // Count unpaid days for reporting
        const unpaidDays = periodAttendance.filter(a => !a.isPaidDay).length;

        if (existingPayout) {
          // Update existing payout
          await prisma.payout.update({
            where: { id: existingPayout.id },
            data: {
              amount: calculatedAmount,
              daysWorked,
              unpaidDays,
              totalHours,
              regularHours,
              overtimeHours,
              excessOvertimeHours,
              basePayout,
              overtimePayout,
              finalAmount: finalAmount,
              includeOvertime: false, // Default to overtime excluded
              comment: `Updated: ${daysWorked} paid days (${label})`,
              updatedAt: new Date()
            }
          });
          totalUpdated++;
          console.log(`[Auto Calculate Payouts] Updated existing payout for ${employee.name}: ${label}`);
        } else {
          // Create new payout
          await prisma.payout.create({
            data: {
              employeeId: employee.id,
              periodStart,
              periodEnd,
              amount: calculatedAmount,
              daysWorked,
              unpaidDays,
              totalHours,
              regularHours,
              overtimeHours,
              excessOvertimeHours,
              basePayout,
              overtimePayout,
              finalAmount: finalAmount,
              includeOvertime: false, // Default to overtime excluded
              comment: `Auto-calculated: ${daysWorked} paid days (${label})`
            }
          });
          totalCreated++;
          console.log(`[Auto Calculate Payouts] Created new payout for ${employee.name}: ${label}`);
        }

        results.push({
          employeeName: employee.name,
          period: label,
          daysWorked,
          totalHours: parseFloat(totalHours.toFixed(1)),
          amount: finalAmount, // Report the actual final amount (base only by default)
          action: existingPayout ? 'updated' : 'created'
        });
      }
    }

    const summary = {
      totalEmployees: employees.length,
      payoutsCreated: totalCreated,
      payoutsUpdated: totalUpdated,
      totalProcessed: totalCreated + totalUpdated
    };

    console.log('[Auto Calculate Payouts] Summary:', summary);

    return NextResponse.json({
      success: true,
      message: `Processed ${employees.length} employees. Created ${totalCreated} new payouts, updated ${totalUpdated} existing payouts.`,
      summary,
      details: results
    });

  } catch (error) {
    console.error('[Auto Calculate Payouts] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate payouts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

interface PaymentPeriod {
  periodStart: Date;
  periodEnd: Date;
  label: string;
}

interface AttendanceRecord {
  date: string | Date;
}

interface EmployeeRecord {
  id: number;
  name: string;
  paymentBasis: string;
  dailyRate: number;
}

function calculatePaymentPeriods(attendance: AttendanceRecord[], employee: EmployeeRecord): PaymentPeriod[] {
  const periods: PaymentPeriod[] = [];
  
  if (attendance.length === 0) return periods;

  // Get date range from attendance data
  const startDate = new Date(attendance[0].date);
  const endDate = new Date(attendance[attendance.length - 1].date);
  
  console.log(`[Period Calc] Employee ${employee.name} has payment basis: ${employee.paymentBasis}`);
  
  if (employee.paymentBasis === 'Weekly') {
    // Generate weekly periods with UTC dates for consistency
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 }); // Start on Sunday
    let currentWeekStart = weekStart;
    
    while (currentWeekStart <= endDate) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 }); // End on Saturday
      
      // Convert to UTC dates for consistency with monthly periods
      const weekStartUTC = new Date(Date.UTC(
        currentWeekStart.getFullYear(), 
        currentWeekStart.getMonth(), 
        currentWeekStart.getDate(), 
        0, 0, 0, 0
      ));
      const weekEndUTC = new Date(Date.UTC(
        weekEnd.getFullYear(), 
        weekEnd.getMonth(), 
        weekEnd.getDate(), 
        23, 59, 59, 999
      ));
      
      // Create human-readable label
      const weekLabel = `Week of ${format(currentWeekStart, 'MMM d, yyyy')}`;
      
      periods.push({
        periodStart: weekStartUTC,
        periodEnd: weekEndUTC,
        label: weekLabel
      });
      
      console.log(`[Period Calc] Created weekly period: ${weekLabel} = ${weekStartUTC.toISOString().split('T')[0]} to ${weekEndUTC.toISOString().split('T')[0]}`);
      
      // Move to next week
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }
  } else {
    // Generate monthly periods (default for Monthly and Daily payment basis)
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth(); // 0-based
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth(); // 0-based
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      // Create PROPER month boundaries - 1st to last day of each month (UTC to avoid timezone issues)
      const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)); // Last day of month at 23:59:59
      
      // Create human-readable label
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const label = `${monthNames[currentMonth]} ${currentYear}`;
      
      periods.push({
        periodStart: monthStart,
        periodEnd: monthEnd,
        label: label
      });
      
      console.log(`[Period Calc] Created monthly period: ${label} = ${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`);
      
      // Move to next month
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }
  }
  
  return periods;
} 