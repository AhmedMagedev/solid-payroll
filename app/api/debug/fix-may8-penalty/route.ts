import { NextResponse } from 'next/server';
import { processAttendanceWithPenalties } from '@/lib/penalty-calculator';
import { prisma } from '@/app/lib/prisma';

export async function POST() {
  try {
    console.log('=== Fixing May 8th, 2025 Penalty for Employee 4 ===');
    
    // Get the specific attendance record for May 8, 2025
    const attendanceRecord = await prisma.attendance.findFirst({
      where: {
        employeeId: 4,
        date: new Date('2025-05-08'),
      },
      include: {
        penalties: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!attendanceRecord) {
      return NextResponse.json({ error: 'No attendance record found for employee 4 on May 8, 2025' });
    }

    console.log('Found attendance record:', {
      id: attendanceRecord.id,
      date: attendanceRecord.date,
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut,
      currentPenaltyAmount: attendanceRecord.totalPenaltyAmount,
      currentPenaltiesCount: attendanceRecord.penalties.length,
    });

    // Store old penalty data for comparison
    const oldPenalties = attendanceRecord.penalties.map(p => ({
      penaltyType: p.penaltyType,
      severity: p.severity,
      earlyMinutes: p.earlyMinutes,
      salaryDeducted: p.salaryDeducted,
      description: p.description,
    }));

    // Reprocess the attendance with penalties
    if (attendanceRecord.checkIn && attendanceRecord.checkOut) {
      console.log('Reprocessing attendance with current penalty calculator...');
      
      const result = await processAttendanceWithPenalties(
        attendanceRecord.id,
        attendanceRecord.employeeId,
        attendanceRecord.checkIn,
        attendanceRecord.checkOut
      );

      console.log('Reprocessing completed. New penalties:', result);

      // Get the updated record
      const updatedRecord = await prisma.attendance.findUnique({
        where: { id: attendanceRecord.id },
        include: {
          penalties: {
            where: {
              isActive: true,
            },
          },
        },
      });

      const newPenalties = updatedRecord?.penalties.map(p => ({
        penaltyType: p.penaltyType,
        severity: p.severity,
        earlyMinutes: p.earlyMinutes,
        salaryDeducted: p.salaryDeducted,
        description: p.description,
      })) || [];

      return NextResponse.json({
        message: 'Successfully reprocessed May 8th, 2025 penalty for Employee 4',
        attendanceRecordId: attendanceRecord.id,
        beforeReprocessing: {
          totalPenaltyAmount: attendanceRecord.totalPenaltyAmount,
          penaltiesCount: oldPenalties.length,
          penalties: oldPenalties,
        },
        afterReprocessing: {
          totalPenaltyAmount: updatedRecord?.totalPenaltyAmount,
          penaltiesCount: newPenalties.length,
          penalties: newPenalties,
        },
        calculationResult: result,
        fixedDate: new Date().toISOString(),
      });

    } else {
      return NextResponse.json({ 
        error: 'Attendance record is missing check-in or check-out time',
        checkIn: attendanceRecord.checkIn?.toISOString(),
        checkOut: attendanceRecord.checkOut?.toISOString(),
      });
    }

  } catch (error) {
    console.error('Error fixing May 8th penalty:', error);
    return NextResponse.json({ 
      error: 'Failed to fix penalty',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 