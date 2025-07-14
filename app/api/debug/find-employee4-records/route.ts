import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET() {
  try {
    console.log('=== Finding all attendance records for Employee 4 ===');
    
    // Get all attendance records for employee 4
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: 4,
      },
      include: {
        penalties: {
          where: {
            isActive: true,
          },
        },
        employee: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    console.log(`Found ${attendanceRecords.length} attendance records for employee 4`);

    const formattedRecords = attendanceRecords.map(record => {
      const workingTime = record.checkIn && record.checkOut 
        ? (record.checkOut.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60)
        : 0;

      return {
        id: record.id,
        date: record.date.toISOString().split('T')[0], // YYYY-MM-DD format
        checkIn: record.checkIn?.toISOString(),
        checkOut: record.checkOut?.toISOString(),
        workingTimeHours: workingTime.toFixed(2),
        totalPenaltyAmount: record.totalPenaltyAmount,
        isPaidDay: record.isPaidDay,
        penaltyCount: record.penalties.length,
        penalties: record.penalties.map(p => ({
          penaltyType: p.penaltyType,
          severity: p.severity,
          description: p.description,
          salaryDeducted: p.salaryDeducted,
          lateMinutes: p.lateMinutes,
          earlyMinutes: p.earlyMinutes,
        })),
      };
    });

    // Look for records with low penalty amounts
    const suspiciousRecords = formattedRecords.filter(record => 
      record.totalPenaltyAmount !== null && 
      record.totalPenaltyAmount > 0 && 
      record.totalPenaltyAmount < 50 // Less than 50 L.E
    );

    return NextResponse.json({
      message: 'All attendance records for Employee 4',
      totalRecords: attendanceRecords.length,
      employeeId: 4,
      employeeDailyRate: attendanceRecords[0]?.employee.dailyRate || 'Unknown',
      allRecords: formattedRecords,
      suspiciousRecords: suspiciousRecords,
      analysisDate: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error finding employee 4 records:', error);
    return NextResponse.json({ 
      error: 'Failed to find employee records',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 