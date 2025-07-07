import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { processAttendanceWithPenalties } from '@/lib/penalty-calculator';

export async function POST() {
  try {
    // Get all attendance records for employee 4 in May 2025
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: 4,
        date: {
          gte: new Date('2025-05-01'),
          lte: new Date('2025-05-31'),
        },
        checkOut: { not: null }, // Only records with check-out times
      },
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`[Reprocess] Found ${attendanceRecords.length} attendance records for May 2025`);

    const results = [];

    for (const record of attendanceRecords) {
      try {
        console.log(`[Reprocess] Processing record ${record.id} for date ${record.date.toISOString().split('T')[0]}`);
        
        if (record.checkOut) {
          const result = await processAttendanceWithPenalties(
            record.id,
            record.employeeId,
            record.checkIn,
            record.checkOut
          );

          results.push({
            id: record.id,
            date: record.date.toISOString().split('T')[0],
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            hoursWorked: record.hoursWorked,
            result,
          });

          console.log(`[Reprocess] ✓ Processed record ${record.id} - Total penalty: L.E ${result.totalSalaryDeducted.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`[Reprocess] Error processing record ${record.id}:`, error);
        results.push({
          id: record.id,
          date: record.date.toISOString().split('T')[0],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Get updated penalty counts
    const updatedCounts = await prisma.attendance.findMany({
      where: {
        employeeId: 4,
        date: {
          gte: new Date('2025-05-01'),
          lte: new Date('2025-05-31'),
        },
      },
      include: {
        _count: {
          select: {
            penalties: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json({
      message: `Reprocessed penalties for ${results.length} attendance records`,
      processed: results.length,
      results,
      summary: updatedCounts.map(r => ({
        id: r.id,
        date: r.date.toISOString().split('T')[0],
        totalPenaltyAmount: r.totalPenaltyAmount,
        isPaidDay: r.isPaidDay,
        penaltyCount: r._count.penalties,
      })),
    });
  } catch (error) {
    console.error('Error reprocessing penalties:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 