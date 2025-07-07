import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyEmployeeToken } from '@/app/lib/employee-auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyEmployeeToken(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get today's date in UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's attendance record
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: auth.employeeId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!attendance) {
      // No attendance record for today
      return NextResponse.json({
        attendance: {
          isCheckedIn: false,
          status: 'not-started',
        },
      });
    }

    // Calculate total hours if both check-in and check-out exist
    let totalHours = 0;
    if (attendance.checkIn && attendance.checkOut) {
      const checkInTime = new Date(attendance.checkIn);
      const checkOutTime = new Date(attendance.checkOut);
      totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    }

    const isCheckedIn = attendance.checkIn && !attendance.checkOut;

    return NextResponse.json({
      attendance: {
        isCheckedIn,
        checkInTime: attendance.checkIn?.toISOString(),
        checkOutTime: attendance.checkOut?.toISOString(),
        totalHours: totalHours > 0 ? totalHours : undefined,
        status: attendance.checkOut ? 'checked-out' : (attendance.checkIn ? 'checked-in' : 'not-started'),
        hoursWorked: attendance.hoursWorked,
        isPaidDay: attendance.isPaidDay,
      },
    });
  } catch (error) {
    console.error('Today attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 