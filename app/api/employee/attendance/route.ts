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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.attendance.count({
      where: {
        employeeId: auth.employeeId,
      },
    });

    // Get attendance records
    const records = await prisma.attendance.findMany({
      where: {
        employeeId: auth.employeeId,
      },
      orderBy: {
        date: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        date: true,
        checkIn: true,
        checkOut: true,
        hoursWorked: true,
        isPaidDay: true,
        actualHoursWorked: true,
        lateDeductionHours: true,
        earlyDeductionHours: true,
        checkInLocationVerified: true,
        checkOutLocationVerified: true,
      },
    });

    return NextResponse.json({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Employee attendance history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 