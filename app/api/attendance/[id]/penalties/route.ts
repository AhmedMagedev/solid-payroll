import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { validateSession } from '@/app/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate session
    const session = await validateSession(request);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const attendanceId = parseInt(id);
    if (isNaN(attendanceId)) {
      return NextResponse.json(
        { message: 'Invalid attendance ID' },
        { status: 400 }
      );
    }

    // Get attendance record with penalties
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            dailyRate: true,
          },
        },
        penalties: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!attendance) {
      return NextResponse.json(
        { message: 'Attendance record not found' },
        { status: 404 }
      );
    }

    // Calculate summary information
    const totalPenaltyAmount = attendance.penalties
      .filter(p => p.isActive && !p.isWaived)
      .reduce((sum, p) => sum + p.salaryDeducted, 0);

    const totalHoursDeducted = attendance.penalties
      .filter(p => p.isActive && !p.isWaived)
      .reduce((sum, p) => sum + p.hoursDeducted, 0);

    const activePenalties = attendance.penalties.filter(p => p.isActive && !p.isWaived);
    const waivedPenalties = attendance.penalties.filter(p => p.isWaived);

    return NextResponse.json({
      attendance: {
        id: attendance.id,
        date: attendance.date,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        hoursWorked: attendance.hoursWorked,
        actualHoursWorked: attendance.actualHoursWorked,
        isPaidDay: attendance.isPaidDay,
        totalPenaltyAmount: attendance.totalPenaltyAmount,
        makeupTimeRequired: attendance.makeupTimeRequired,
        makeupTimeCompleted: attendance.makeupTimeCompleted,
      },
      employee: attendance.employee,
      penalties: {
        active: activePenalties.map(p => ({
          id: p.id,
          penaltyType: p.penaltyType,
          severity: p.severity,
          description: p.description,
          lateMinutes: p.lateMinutes,
          earlyMinutes: p.earlyMinutes,
          missedHours: p.missedHours,
          hoursDeducted: p.hoursDeducted,
          salaryDeducted: p.salaryDeducted,
          makeupRequired: p.makeupRequired,
          makeupHours: p.makeupHours,
          createdAt: p.createdAt,
        })),
        waived: waivedPenalties.map(p => ({
          id: p.id,
          penaltyType: p.penaltyType,
          severity: p.severity,
          description: p.description,
          hoursDeducted: p.hoursDeducted,
          salaryDeducted: p.salaryDeducted,
          waivedReason: p.waivedReason,
          waivedBy: p.waivedBy,
          waivedAt: p.waivedAt,
          createdAt: p.createdAt,
        })),
      },
      summary: {
        totalPenaltyAmount,
        totalHoursDeducted,
        activePenaltyCount: activePenalties.length,
        waivedPenaltyCount: waivedPenalties.length,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance penalties:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 