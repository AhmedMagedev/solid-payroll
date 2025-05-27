import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';
import { endOfDay, startOfDay, subDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const prisma = new PrismaClient();

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

    // Get current date and week
    const today = new Date();
    const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 }); // Start week on Monday
    const endOfThisWeek = endOfWeek(today, { weekStartsOn: 1 });
    
    // Get system settings for working hours
    const systemSettings = await prisma.systemSettings.findFirst();
    const workingHoursPerDay = systemSettings?.workingHoursPerDay || 8;
    const lateAllowanceMinutes = systemSettings?.lateAllowanceMinutes || 15;
    const workingHoursStart = systemSettings?.workingHoursStart || "09:00";
    
    // 1. Total Employees
    const totalEmployees = await prisma.employee.count();
    
    // Get unpaid employees count (employees with unpaid payouts)
    const unpaidPayouts = await prisma.payout.findMany({
      where: {
        isPaid: false
      },
      select: {
        employeeId: true
      },
      distinct: ['employeeId']
    });
    const unpaidEmployeesCount = unpaidPayouts.length;
    
    // Calculate overtime payout for this month
    const startOfThisMonth = startOfMonth(today);
    const endOfThisMonth = endOfMonth(today);
    
    const thisMonthOvertimeData = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfThisMonth,
          lte: endOfThisMonth
        },
        hoursWorked: {
          gt: workingHoursPerDay
        }
      },
      include: {
        employee: {
          select: {
            dailyRate: true
          }
        }
      }
    });
    
    let totalOvertimePayout = 0;
    thisMonthOvertimeData.forEach(attendance => {
      const overtimeHours = (attendance.hoursWorked || 0) - workingHoursPerDay;
      const hourlyRate = attendance.employee.dailyRate / workingHoursPerDay;
      // Assuming overtime is paid at 1.5x rate (can be made configurable)
      const overtimeRate = hourlyRate * (systemSettings?.overtimeMultiplier || 1.5);
      totalOvertimePayout += overtimeHours * overtimeRate;
    });
    
    // 2. Attendance Rate by Week (last 4 weeks)
    const weeklyAttendanceData = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfDay(subDays(startOfThisWeek, i * 7));
      const weekEnd = endOfDay(subDays(endOfThisWeek, i * 7));
      
      const attendanceCount = await prisma.attendance.count({
        where: {
          date: {
            gte: weekStart,
            lte: weekEnd
          }
        }
      });
      
      // Calculate expected attendance (total employees * working days in week)
      const workingDaysInWeek = getWorkingDaysInWeek(weekStart, systemSettings);
      const expectedAttendance = totalEmployees * workingDaysInWeek;
      const attendanceRate = expectedAttendance > 0 ? Math.round((attendanceCount / expectedAttendance) * 100) : 0;
      
      weeklyAttendanceData.unshift({
        week: format(weekStart, 'MMM dd'),
        attendanceRate,
        actualAttendance: attendanceCount,
        expectedAttendance
      });
    }
    
    // 3. Late Arrivals percentage (pie chart)
    const thisWeekAttendance = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfThisWeek,
          lte: endOfThisWeek
        }
      }
    });
    
    let lateArrivals = 0;
    let onTimeArrivals = 0;
    
    thisWeekAttendance.forEach(attendance => {
      const checkInTime = new Date(attendance.checkIn);
      const expectedStartTime = new Date(attendance.date);
      const [hours, minutes] = workingHoursStart.split(':');
      expectedStartTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
      
      if (checkInTime > expectedStartTime) {
        lateArrivals++;
      } else {
        onTimeArrivals++;
      }
    });
    
    const lateArrivalsData = [
      { name: 'On Time', value: onTimeArrivals, percentage: Math.round((onTimeArrivals / (onTimeArrivals + lateArrivals || 1)) * 100) },
      { name: 'Late', value: lateArrivals, percentage: Math.round((lateArrivals / (onTimeArrivals + lateArrivals || 1)) * 100) }
    ];
    
    // 4. Overtime Hours This week by whom
    const overtimeData = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfThisWeek,
          lte: endOfThisWeek
        },
        hoursWorked: {
          gt: workingHoursPerDay
        }
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            position: true
          }
        }
      }
    });
    
    // Group overtime by employee
    interface OvertimeEmployee {
      employee: {
        id: number;
        name: string;
        position: string;
      };
      totalOvertimeHours: number;
      overtimeDays: number;
    }
    
    const overtimeByEmployee: Record<number, OvertimeEmployee> = overtimeData.reduce((acc, attendance) => {
      const employeeId = attendance.employee.id;
      const overtimeHours = (attendance.hoursWorked || 0) - workingHoursPerDay;
      
      if (!acc[employeeId]) {
        acc[employeeId] = {
          employee: attendance.employee,
          totalOvertimeHours: 0,
          overtimeDays: 0
        };
      }
      
      acc[employeeId].totalOvertimeHours += overtimeHours;
      acc[employeeId].overtimeDays += 1;
      
      return acc;
    }, {} as Record<number, OvertimeEmployee>);
    
    const overtimeEmployees = Object.values(overtimeByEmployee).sort((a, b) => 
      b.totalOvertimeHours - a.totalOvertimeHours
    );
    
    // 5. Absenteeism Rate (pie chart)
    const totalExpectedAttendanceThisWeek = totalEmployees * getWorkingDaysInWeek(startOfThisWeek, systemSettings);
    const actualAttendanceThisWeek = await prisma.attendance.count({
      where: {
        date: {
          gte: startOfThisWeek,
          lte: endOfThisWeek
        }
      }
    });
    
    const absenteeismData = [
      { 
        name: 'Present', 
        value: actualAttendanceThisWeek,
        percentage: Math.round((actualAttendanceThisWeek / (totalExpectedAttendanceThisWeek || 1)) * 100)
      },
      { 
        name: 'Absent', 
        value: Math.max(0, totalExpectedAttendanceThisWeek - actualAttendanceThisWeek),
        percentage: Math.round(((totalExpectedAttendanceThisWeek - actualAttendanceThisWeek) / (totalExpectedAttendanceThisWeek || 1)) * 100)
      }
    ];
    
    // Return the required stats
    return NextResponse.json({
      totalEmployees,
      unpaidEmployeesCount,
      totalOvertimePayout,
      weeklyAttendanceData,
      lateArrivalsData,
      overtimeEmployees,
      absenteeismData,
      thisWeekStats: {
        totalExpectedAttendance: totalExpectedAttendanceThisWeek,
        actualAttendance: actualAttendanceThisWeek,
        totalLateArrivals: lateArrivals,
        totalOnTime: onTimeArrivals
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}

// Helper function to calculate working days in a week based on system settings
function getWorkingDaysInWeek(weekStart: Date, systemSettings: { 
  workDayMonday?: boolean;
  workDayTuesday?: boolean;
  workDayWednesday?: boolean;
  workDayThursday?: boolean;
  workDayFriday?: boolean;
  workDaySaturday?: boolean;
  workDaySunday?: boolean;
} | null) {
  if (!systemSettings) {
    return 5; // Default to 5 working days (Mon-Fri)
  }
  
  const workDays = [
    systemSettings.workDayMonday,    // Monday
    systemSettings.workDayTuesday,   // Tuesday
    systemSettings.workDayWednesday, // Wednesday
    systemSettings.workDayThursday,  // Thursday
    systemSettings.workDayFriday,    // Friday
    systemSettings.workDaySaturday,  // Saturday
    systemSettings.workDaySunday     // Sunday
  ];
  
  return workDays.filter(Boolean).length;
} 