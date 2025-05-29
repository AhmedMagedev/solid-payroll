import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, parseISO, isWithinInterval } from 'date-fns';

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
      const periods = calculatePaymentPeriods(employee.paymentBasis, attendance);
      
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
        const calculatedAmount = daysWorked * employee.dailyRate;
        const unpaidDays = periodAttendance.length - daysWorked;

        if (existingPayout) {
          // Update existing payout if the calculated amount is different
          if (existingPayout.amount !== calculatedAmount) {
            await prisma.payout.update({
              where: { id: existingPayout.id },
              data: { 
                amount: calculatedAmount,
                updatedAt: new Date()
              }
            });
            totalUpdated++;
            console.log(`[Auto Calculate Payouts] Updated payout ${existingPayout.id} for ${employee.name} (${label}): ${calculatedAmount}`);
          }
        } else {
          // Create new payout
          const newPayout = await prisma.payout.create({
            data: {
              employeeId: employee.id,
              periodStart,
              periodEnd,
              amount: calculatedAmount,
              isPaid: false,
              comment: `Auto-calculated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}`
            }
          });
          totalCreated++;
          console.log(`[Auto Calculate Payouts] Created payout ${newPayout.id} for ${employee.name} (${label}): ${calculatedAmount}`);
        }

        results.push({
          employeeName: employee.name,
          period: label,
          daysWorked,
          totalHours: parseFloat(totalHours.toFixed(1)),
          amount: calculatedAmount,
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

function calculatePaymentPeriods(paymentBasis: string, attendance: AttendanceRecord[]): PaymentPeriod[] {
  const periods: PaymentPeriod[] = [];
  
  if (attendance.length === 0) return periods;

  // Get date range from attendance data
  const startDate = new Date(attendance[0].date);
  const endDate = new Date(attendance[attendance.length - 1].date);
  
  switch (paymentBasis) {
    case 'Weekly':
      let weekStart = startOfWeek(startDate);
      while (weekStart <= endDate) {
        const weekEnd = endOfWeek(weekStart);
        periods.push({
          periodStart: weekStart,
          periodEnd: weekEnd,
          label: `Week of ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
        });
        weekStart = addWeeks(weekStart, 1);
      }
      break;
      
    case 'Biweekly':
      let biweekStart = startOfWeek(startDate);
      while (biweekStart <= endDate) {
        const biweekEnd = endOfWeek(addWeeks(biweekStart, 1));
        periods.push({
          periodStart: biweekStart,
          periodEnd: biweekEnd,
          label: `${biweekStart.toLocaleDateString()} - ${biweekEnd.toLocaleDateString()}`
        });
        biweekStart = addWeeks(biweekStart, 2);
      }
      break;
      
    case 'Monthly':
    default:
      let monthStart = startOfMonth(startDate);
      while (monthStart <= endDate) {
        const monthEnd = endOfMonth(monthStart);
        periods.push({
          periodStart: monthStart,
          periodEnd: monthEnd,
          label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        });
        monthStart = startOfMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1));
      }
  }
  
  return periods;
} 