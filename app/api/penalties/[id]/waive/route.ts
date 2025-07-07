import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { validateAdminSession } from '@/app/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin session
    const session = await validateAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const penaltyId = parseInt(id);
    if (isNaN(penaltyId)) {
      return NextResponse.json(
        { message: 'Invalid penalty ID' },
        { status: 400 }
      );
    }

    const { reason } = await request.json();
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { message: 'Waiver reason is required' },
        { status: 400 }
      );
    }

    // Check if penalty exists and is not already waived
    const penalty = await prisma.attendancePenalty.findUnique({
      where: { id: penaltyId },
      include: {
        attendance: {
          include: {
            employee: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!penalty) {
      return NextResponse.json(
        { message: 'Penalty not found' },
        { status: 404 }
      );
    }

    if (penalty.isWaived) {
      return NextResponse.json(
        { message: 'Penalty is already waived' },
        { status: 400 }
      );
    }

    // Waive the penalty
    const updatedPenalty = await prisma.attendancePenalty.update({
      where: { id: penaltyId },
      data: {
        isWaived: true,
        waivedReason: reason.trim(),
        waivedBy: session.username,
        waivedAt: new Date(),
      },
    });

    // Recalculate attendance penalty totals
    const allPenalties = await prisma.attendancePenalty.findMany({
      where: {
        attendanceId: penalty.attendanceId,
        isActive: true,
        isWaived: false,
      },
    });

    const totalPenaltyAmount = allPenalties.reduce((sum, p) => sum + p.salaryDeducted, 0);
    const totalMakeupHours = allPenalties.reduce((sum, p) => sum + p.makeupHours, 0);

    // Update attendance record
    await prisma.attendance.update({
      where: { id: penalty.attendanceId },
      data: {
        totalPenaltyAmount,
        makeupTimeRequired: totalMakeupHours,
      },
    });

    console.log(`[Penalty Waived] Admin ${session.username} waived penalty ${penaltyId} for employee ${penalty.attendance.employee.name}. Reason: ${reason}`);

    return NextResponse.json({
      message: 'Penalty waived successfully',
      penalty: {
        id: updatedPenalty.id,
        isWaived: updatedPenalty.isWaived,
        waivedReason: updatedPenalty.waivedReason,
        waivedBy: updatedPenalty.waivedBy,
        waivedAt: updatedPenalty.waivedAt,
      },
      newTotals: {
        totalPenaltyAmount,
        totalMakeupHours,
      },
    });
  } catch (error) {
    console.error('Error waiving penalty:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 