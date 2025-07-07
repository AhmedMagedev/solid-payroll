import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { processAttendanceWithPenalties } from '@/lib/penalty-calculator';

export async function GET() {
  try {
    // Get the first attendance record for employee 4 to test penalties
    const attendanceRecord = await prisma.attendance.findFirst({
      where: {
        employeeId: 4,
        checkOut: { not: null }, // Only records with check-out times
      },
      include: {
        employee: true,
        penalties: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (!attendanceRecord) {
      return NextResponse.json(
        { message: 'No attendance record found for employee 4' },
        { status: 404 }
      );
    }

    console.log('[Debug] Found attendance record:', {
      id: attendanceRecord.id,
      employeeId: attendanceRecord.employeeId,
      date: attendanceRecord.date,
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut,
      existingPenalties: attendanceRecord.penalties.length,
    });

    // Test penalty processing
    if (attendanceRecord.checkOut) {
      const result = await processAttendanceWithPenalties(
        attendanceRecord.id,
        attendanceRecord.employeeId,
        attendanceRecord.checkIn,
        attendanceRecord.checkOut
      );

      // Fetch the updated record with penalties
      const updatedRecord = await prisma.attendance.findUnique({
        where: { id: attendanceRecord.id },
        include: {
          penalties: {
            where: { isActive: true },
          },
        },
      });

      return NextResponse.json({
        message: 'Penalty processing test completed',
        original: {
          id: attendanceRecord.id,
          date: attendanceRecord.date,
          checkIn: attendanceRecord.checkIn,
          checkOut: attendanceRecord.checkOut,
          totalPenaltyAmount: attendanceRecord.totalPenaltyAmount,
          existingPenalties: attendanceRecord.penalties.length,
        },
        penaltyResult: result,
        updated: {
          id: updatedRecord?.id,
          totalPenaltyAmount: updatedRecord?.totalPenaltyAmount,
          graceMinutesUsed: updatedRecord?.graceMinutesUsed,
          lateMinutesBeyondGrace: updatedRecord?.lateMinutesBeyondGrace,
          makeupTimeRequired: updatedRecord?.makeupTimeRequired,
          penalties: updatedRecord?.penalties.map(p => ({
            id: p.id,
            penaltyType: p.penaltyType,
            severity: p.severity,
            description: p.description,
            lateMinutes: p.lateMinutes,
            hoursDeducted: p.hoursDeducted,
            salaryDeducted: p.salaryDeducted,
          })),
        },
      });
    } else {
      return NextResponse.json(
        { message: 'Attendance record has no check-out time' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in penalty debug:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 