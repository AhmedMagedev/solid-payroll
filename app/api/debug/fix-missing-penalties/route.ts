import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { processAttendanceWithPenalties } from '@/lib/penalty-calculator';

export async function POST() {
  try {
    // Get specific attendance records that are missing penalties
    const recordsToFix = [750, 843, 891]; // May 5, 13, 19
    
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        id: { in: recordsToFix },
        checkOut: { not: null }, // Only records with check-out times
      },
    });

    console.log(`[Fix Missing] Found ${attendanceRecords.length} records to fix`);

    const results = [];

    for (const record of attendanceRecords) {
      try {
        console.log(`[Fix Missing] Processing record ${record.id} for date ${record.date.toISOString().split('T')[0]}`);
        console.log(`[Fix Missing] Check-in: ${record.checkIn}, Check-out: ${record.checkOut}, Hours: ${record.hoursWorked}`);
        
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
            beforeFix: {
              totalPenaltyAmount: record.totalPenaltyAmount,
              isPaidDay: record.isPaidDay,
            },
            afterFix: result,
          });

          console.log(`[Fix Missing] ✓ Fixed record ${record.id} - Total penalty: L.E ${result.totalSalaryDeducted.toFixed(2)}, Paid day: ${result.isPaidDay}`);
        }
      } catch (error) {
        console.error(`[Fix Missing] Error processing record ${record.id}:`, error);
        results.push({
          id: record.id,
          date: record.date.toISOString().split('T')[0],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Get updated records to verify
    const updatedRecords = await prisma.attendance.findMany({
      where: {
        id: { in: recordsToFix },
      },
      include: {
        penalties: {
          where: { isActive: true },
        },
      },
    });

    return NextResponse.json({
      message: `Fixed penalties for ${results.length} records`,
      results,
      updated: updatedRecords.map(r => ({
        id: r.id,
        date: r.date.toISOString().split('T')[0],
        hoursWorked: r.hoursWorked,
        totalPenaltyAmount: r.totalPenaltyAmount,
        isPaidDay: r.isPaidDay,
        penaltyCount: r.penalties.length,
        penalties: r.penalties.map(p => ({
          type: p.penaltyType,
          severity: p.severity,
          description: p.description,
          salaryDeducted: p.salaryDeducted,
        })),
      })),
    });
  } catch (error) {
    console.error('Error fixing missing penalties:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 