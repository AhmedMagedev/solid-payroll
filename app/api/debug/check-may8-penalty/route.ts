import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { PenaltyCalculator } from '@/lib/penalty-calculator';

export async function GET() {
  try {
    console.log('=== Investigating May 8th, 2025 Penalty for Employee 4 ===');
    
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
        employee: true,
      },
    });

    if (!attendanceRecord) {
      return NextResponse.json({ error: 'No attendance record found for employee 4 on May 8, 2025' });
    }

    console.log('Raw attendance record:', {
      id: attendanceRecord.id,
      employeeId: attendanceRecord.employeeId,
      date: attendanceRecord.date,
      checkIn: attendanceRecord.checkIn,
      checkOut: attendanceRecord.checkOut,
      totalPenaltyAmount: attendanceRecord.totalPenaltyAmount,
      isPaidDay: attendanceRecord.isPaidDay,
    });

    console.log('Employee details:', {
      hourlyRate: attendanceRecord.employee.hourlyRate,
      paymentBasis: attendanceRecord.employee.paymentBasis,
    });

    console.log('Stored penalties:', attendanceRecord.penalties);

    // Get system settings
    const systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings) {
      return NextResponse.json({ error: 'System settings not found' });
    }

    // Recalculate penalties to see what should happen
    const calculator = new PenaltyCalculator({
      lateAllowanceMinutes: systemSettings.lateAllowanceMinutes || 30,
      workingHoursStart: systemSettings.workingHoursStart,
      workingHoursEnd: systemSettings.workingHoursEnd,
      workingHoursPerDay: 8, // Default working hours per day
      allowMakeupTime: true,
      makeupTimeDeadlineHours: 24,
    });

    let recalculatedResult = null;
    if (attendanceRecord.checkIn && attendanceRecord.checkOut) {
      recalculatedResult = await calculator.calculatePenalties(
        attendanceRecord.employeeId,
        attendanceRecord.checkIn,
        attendanceRecord.checkOut,
        systemSettings.workingHoursStart,
        systemSettings.workingHoursEnd,
        8, // Default working hours per day
        attendanceRecord.employee.hourlyRate || 50
      );
    }

    console.log('Recalculated penalties:', recalculatedResult);

    // Calculate working hours
    const workingTime = attendanceRecord.checkIn && attendanceRecord.checkOut 
      ? (attendanceRecord.checkOut.getTime() - attendanceRecord.checkIn.getTime()) / (1000 * 60 * 60)
      : 0;

    // Calculate early departure details manually
    let earlyDepartureDetails = null;
    if (attendanceRecord.checkIn && attendanceRecord.checkOut) {
      const [endHour, endMinute] = systemSettings.workingHoursEnd.split(':').map(Number);
      
      // Use check-in date as the base for expected end time (correct timezone handling)
      const expectedEndTime = new Date(attendanceRecord.checkIn);
      expectedEndTime.setHours(endHour, endMinute, 0, 0);
      
      const actualCheckOut = attendanceRecord.checkOut;
      const earlyMinutes = Math.max(0, Math.floor((expectedEndTime.getTime() - actualCheckOut.getTime()) / (1000 * 60)));
      
      // Calculate penalty based on early minutes
      const graceMinutes = systemSettings.lateAllowanceMinutes || 30;
      const minutesBeyondGrace = Math.max(0, earlyMinutes - graceMinutes);
      
      let expectedPenalty = null;
      if (earlyMinutes > graceMinutes) {
        if (minutesBeyondGrace <= 60) {
          // Minor penalty: 1 hour deduction
          expectedPenalty = {
            severity: 'MINOR',
            hoursDeducted: 1,
            salaryDeducted: attendanceRecord.employee.hourlyRate * 1,
            description: '1 hour penalty for minor early departure'
          };
        } else if (minutesBeyondGrace <= 120) {
          // Moderate penalty: 3 hours deduction
          expectedPenalty = {
            severity: 'MODERATE',
            hoursDeducted: 3,
            salaryDeducted: attendanceRecord.employee.hourlyRate * 3,
            description: '3 hours penalty for moderate early departure'
          };
        }
      }
      
      earlyDepartureDetails = {
        checkInTime: attendanceRecord.checkIn.toISOString(),
        expectedEndTime: expectedEndTime.toISOString(),
        actualCheckOut: actualCheckOut.toISOString(),
        workingHoursEnd: systemSettings.workingHoursEnd,
        earlyMinutes,
        earlyHours: earlyMinutes / 60,
        graceMinutes,
        minutesBeyondGrace,
        expectedPenalty,
        actualPenaltyFromDB: attendanceRecord.penalties[0] || null,
      };
    }

    return NextResponse.json({
      message: 'May 8th, 2025 penalty investigation for Employee 4',
      attendanceRecord: {
        id: attendanceRecord.id,
        employeeId: attendanceRecord.employeeId,
        date: attendanceRecord.date.toISOString(),
        checkIn: attendanceRecord.checkIn?.toISOString(),
        checkOut: attendanceRecord.checkOut?.toISOString(),
        workingTimeHours: workingTime.toFixed(2),
        totalPenaltyAmount: attendanceRecord.totalPenaltyAmount,
        isPaidDay: attendanceRecord.isPaidDay,
      },
      employeeDetails: {
        hourlyRate: attendanceRecord.employee.hourlyRate,
        paymentBasis: attendanceRecord.employee.paymentBasis,
        defaultWorkingHoursPerDay: 8,
      },
      systemSettings: {
        workingHoursStart: systemSettings.workingHoursStart,
        workingHoursEnd: systemSettings.workingHoursEnd,
        lateAllowanceMinutes: systemSettings.lateAllowanceMinutes,
      },
      storedPenalties: attendanceRecord.penalties.map(p => ({
        id: p.id,
        penaltyType: p.penaltyType,
        severity: p.severity,
        description: p.description,
        lateMinutes: p.lateMinutes,
        earlyMinutes: p.earlyMinutes,
        hoursDeducted: p.hoursDeducted,
        salaryDeducted: p.salaryDeducted,
        makeupHours: p.makeupHours,
        isWaived: p.isWaived,
      })),
      recalculatedPenalties: recalculatedResult,
      earlyDepartureDetails,
      possibleIssue: "The penalty amount seems unusually low for 54 minutes early departure",
      analysisDate: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error investigating May 8th penalty:', error);
    return NextResponse.json({ 
      error: 'Failed to investigate penalty',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 