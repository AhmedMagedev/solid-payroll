import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { processAttendanceWithPenalties } from '@/lib/penalty-calculator';

export async function POST() {
  try {
    console.log('=== Finding and fixing zero-hours records marked as paid ===');
    
    // Find all attendance records where check-in and check-out exist and day is marked as paid
    const zeroHoursRecords = await prisma.attendance.findMany({
      where: {
        isPaidDay: true, // Currently marked as paid but might not be correct
      },
      include: {
        employee: true,
        penalties: {
          where: { isActive: true }
        }
      },
      orderBy: [
        { employeeId: 'asc' },
        { date: 'desc' }
      ]
    });

    console.log(`Found ${zeroHoursRecords.length} total records to check`);

    // Filter to only records where check-in and check-out are exactly the same time
    const actualZeroHoursRecords = zeroHoursRecords.filter(record => {
      if (!record.checkIn || !record.checkOut) return false;
      return record.checkIn.getTime() === record.checkOut.getTime();
    });

    console.log(`Found ${actualZeroHoursRecords.length} records with zero working hours marked as paid`);

    const results = [];
    const errors = [];

    for (const record of actualZeroHoursRecords) {
      try {
        const dateStr = record.date.toISOString().split('T')[0];
        console.log(`[Fix] Processing Employee ${record.employeeId} - ${dateStr}`);
        console.log(`[Fix] Current state: checkIn=${record.checkIn?.toISOString()}, checkOut=${record.checkOut?.toISOString()}, isPaid=${record.isPaidDay}`);

        // Reprocess with updated penalty logic
        const result = await processAttendanceWithPenalties(
          record.id,
          record.employeeId,
          record.checkIn!,
          record.checkOut!
        );

        // Get the updated record to verify the fix
        const updatedRecord = await prisma.attendance.findUnique({
          where: { id: record.id },
          include: {
            penalties: {
              where: { isActive: true }
            }
          }
        });

        results.push({
          id: record.id,
          employeeId: record.employeeId,
          employeeName: record.employee.name,
          date: dateStr,
          checkIn: record.checkIn?.toISOString(),
          checkOut: record.checkOut?.toISOString(),
          workingHours: 0,
          before: {
            isPaidDay: record.isPaidDay,
            totalPenaltyAmount: record.totalPenaltyAmount,
            penalties: record.penalties.map((p) => ({
              type: p.penaltyType,
              severity: p.severity,
              description: p.description,
              amount: p.salaryDeducted
            }))
          },
          after: {
            isPaidDay: updatedRecord?.isPaidDay,
            totalPenaltyAmount: updatedRecord?.totalPenaltyAmount,
            penalties: updatedRecord?.penalties.map((p) => ({
              type: p.penaltyType,
              severity: p.severity,
              description: p.description,
              amount: p.salaryDeducted
            })) || []
          },
          penaltyCalculationResult: result
        });

        console.log(`[Fix] ✓ Fixed Employee ${record.employeeId} - ${dateStr}: isPaid=${updatedRecord?.isPaidDay}, penalty=L.E ${updatedRecord?.totalPenaltyAmount}`);

      } catch (error) {
        console.error(`[Fix] Error processing record ${record.id}:`, error);
        errors.push({
          id: record.id,
          employeeId: record.employeeId,
          date: record.date.toISOString().split('T')[0],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: 'Zero-hours records fix completed',
      summary: {
        totalRecordsChecked: zeroHoursRecords.length,
        zeroHoursRecordsFound: actualZeroHoursRecords.length,
        recordsFixed: results.length,
        errors: errors.length
      },
      fixedRecords: results,
      errors: errors,
      analysisDate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fixing zero-hours records:', error);
    return NextResponse.json({ 
      error: 'Failed to fix zero-hours records',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 