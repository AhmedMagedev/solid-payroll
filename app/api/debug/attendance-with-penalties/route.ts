import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    // Get attendance records for employee 4 with penalties to test the API
    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId: 4,
      },
      include: {
        penalties: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 5, // Get the 5 most recent records
    });

    return NextResponse.json({
      message: 'Attendance records with penalties',
      records: attendance.map(record => ({
        id: record.id,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        hoursWorked: record.hoursWorked,
        totalPenaltyAmount: record.totalPenaltyAmount,
        penalties: record.penalties.map(p => ({
          id: p.id,
          penaltyType: p.penaltyType,
          severity: p.severity,
          description: p.description,
          lateMinutes: p.lateMinutes,
          earlyMinutes: p.earlyMinutes,
          hoursDeducted: p.hoursDeducted,
          salaryDeducted: p.salaryDeducted,
          isActive: p.isActive,
          isWaived: p.isWaived,
        })),
      })),
    });
  } catch (error) {
    console.error('Error in attendance debug:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 