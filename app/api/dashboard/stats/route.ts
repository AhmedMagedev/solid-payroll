import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';

export async function GET() {
  try {
    // Get current date
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    
    // Get the dates for yesterday and last 7 days
    const yesterday = subDays(today, 1);
    const startOfYesterday = startOfDay(yesterday);
    const endOfYesterday = endOfDay(yesterday);
    const startOfLastWeek = startOfDay(subDays(today, 7));
    
    // Get employee count
    const totalEmployees = await prisma.employee.count();
    
    // Get attendance stats for today
    const todayAttendance = await prisma.attendance.count({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });
    
    // Get attendance stats for yesterday
    const yesterdayAttendance = await prisma.attendance.count({
      where: {
        date: {
          gte: startOfYesterday,
          lte: endOfYesterday
        }
      }
    });
    
    // Get attendance stats for the last 7 days
    const last7DaysAttendance = await prisma.attendance.count({
      where: {
        date: {
          gte: startOfLastWeek,
          lte: endOfToday
        }
      }
    });
    
    // Get attendance distribution by day for the past week
    const attendanceByDay = await prisma.attendance.groupBy({
      by: ['date'],
      _count: {
        id: true
      },
      where: {
        date: {
          gte: startOfLastWeek,
          lte: endOfToday
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    // Format attendance by day for chart
    const attendanceChartData = attendanceByDay.map(day => ({
      date: format(day.date, 'MMM dd'),
      count: day._count.id
    }));
    
    // Get present employees for today
    const presentEmployees = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      include: {
        employee: {
          select: {
            name: true,
            position: true
          }
        }
      },
      take: 5,
      orderBy: {
        checkIn: 'asc'
      }
    });
    
    // Calculate attendance percentage
    const attendancePercentage = totalEmployees > 0 
      ? Math.round((todayAttendance / totalEmployees) * 100) 
      : 0;
    
    // Get payment basis distribution
    const paymentBasisDistribution = await prisma.employee.groupBy({
      by: ['paymentBasis'],
      _count: {
        id: true
      }
    });
    
    // Format payment basis for chart
    const paymentBasisChartData = paymentBasisDistribution.map(item => ({
      name: item.paymentBasis || 'Monthly',
      value: item._count.id
    }));
    
    // Get employees with highest daily rates
    const topEmployeesByRate = await prisma.employee.findMany({
      orderBy: {
        dailyRate: 'desc'
      },
      select: {
        id: true,
        name: true,
        position: true,
        dailyRate: true
      },
      take: 5
    });
    
    // Return all the stats
    return NextResponse.json({
      totalEmployees,
      todayAttendance,
      yesterdayAttendance,
      last7DaysAttendance,
      attendancePercentage,
      attendanceChartData,
      presentEmployees,
      paymentBasisChartData,
      topEmployeesByRate
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
} 