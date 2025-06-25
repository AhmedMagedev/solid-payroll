import { prisma } from '@/app/lib/prisma';

export interface PenaltyRule {
  severity: 'GRACE_PERIOD' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'FULL_DAY';
  description: string;
  hoursDeducted?: number;
  salaryDeductionRatio?: number; // 0.5 for half day, 1.0 for full day
  makeupRequired: boolean;
}

export interface PenaltyCalculationResult {
  penalties: Array<{
    penaltyType: string;
    severity: string;
    description: string;
    lateMinutes?: number;
    earlyMinutes?: number;
    missedHours?: number;
    hoursDeducted: number;
    salaryDeducted: number;
    makeupRequired: boolean;
    makeupHours: number;
  }>;
  totalHoursDeducted: number;
  totalSalaryDeducted: number;
  totalMakeupHours: number;
  isPaidDay: boolean;
}

interface SystemSettings {
  lateAllowanceMinutes: number;
  workingHoursStart: string;
  workingHoursPerDay: number;
  allowMakeupTime: boolean;
  makeupTimeDeadlineHours: number;
}

export class PenaltyCalculator {
  private settings: SystemSettings;
  
  constructor(settings: SystemSettings) {
    this.settings = settings;
  }

  /**
   * Calculate penalties for attendance record
   */
  async calculatePenalties(
    employeeId: number,
    checkIn: Date,
    checkOut: Date | null,
    workingHoursStart: string,
    workingHoursPerDay: number,
    hourlyRate: number
  ): Promise<PenaltyCalculationResult> {
    const result: PenaltyCalculationResult = {
      penalties: [],
      totalHoursDeducted: 0,
      totalSalaryDeducted: 0,
      totalMakeupHours: 0,
      isPaidDay: true,
    };

    // Calculate late arrival penalty
    const lateArrivalPenalty = this.calculateLateArrivalPenalty(
      checkIn,
      workingHoursStart,
      hourlyRate,
      workingHoursPerDay
    );
    
    if (lateArrivalPenalty) {
      result.penalties.push(lateArrivalPenalty);
      result.totalHoursDeducted += lateArrivalPenalty.hoursDeducted;
      result.totalSalaryDeducted += lateArrivalPenalty.salaryDeducted;
      result.totalMakeupHours += lateArrivalPenalty.makeupHours;
    }

    // Calculate early departure penalty (only if not already a full day penalty)
    if (checkOut && !result.penalties.find(p => p.severity === 'FULL_DAY')) {
      const earlyDeparturePenalty = this.calculateEarlyDeparturePenalty(
        checkOut,
        checkIn,
        workingHoursPerDay,
        hourlyRate
      );
      
      if (earlyDeparturePenalty) {
        result.penalties.push(earlyDeparturePenalty);
        result.totalHoursDeducted += earlyDeparturePenalty.hoursDeducted;
        result.totalSalaryDeducted += earlyDeparturePenalty.salaryDeducted;
        result.totalMakeupHours += earlyDeparturePenalty.makeupHours;
      }
    }

    // Apply daily salary cap - total penalties cannot exceed daily salary
    const dailySalary = hourlyRate * workingHoursPerDay;
    if (result.totalSalaryDeducted > dailySalary) {
      const ratio = dailySalary / result.totalSalaryDeducted;
      
      // Scale down all penalty amounts proportionally
      result.penalties.forEach(penalty => {
        penalty.salaryDeducted = penalty.salaryDeducted * ratio;
        penalty.hoursDeducted = penalty.hoursDeducted * ratio;
      });
      
      result.totalSalaryDeducted = dailySalary;
      result.totalHoursDeducted = workingHoursPerDay;
      
      // Update penalty descriptions to indicate capped amount
      result.penalties.forEach(penalty => {
        if (penalty.severity !== 'GRACE_PERIOD') {
          penalty.description += ` (Capped at daily salary limit: L.E ${penalty.salaryDeducted.toFixed(2)})`;
        }
      });
    }

    // Determine if day is still paid
    const fullDayPenalty = result.penalties.find(p => p.severity === 'FULL_DAY');
    if (fullDayPenalty || result.totalSalaryDeducted >= dailySalary) {
      result.isPaidDay = false;
    }

    return result;
  }

  /**
   * Calculate late arrival penalty based on business rules
   */
  private calculateLateArrivalPenalty(
    checkIn: Date,
    workingHoursStart: string,
    hourlyRate: number,
    workingHoursPerDay: number
  ) {
    const [startHour, startMinute] = workingHoursStart.split(':').map(Number);
    const expectedStartTime = new Date(checkIn);
    expectedStartTime.setHours(startHour, startMinute, 0, 0);

    const lateMinutes = Math.max(0, Math.floor((checkIn.getTime() - expectedStartTime.getTime()) / (1000 * 60)));
    
    if (lateMinutes === 0) {
      return null; // On time
    }

    const graceMinutes = this.settings.lateAllowanceMinutes || 30;
    
    // Within grace period - requires makeup time
    if (lateMinutes <= graceMinutes) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'GRACE_PERIOD',
        description: `Arrived ${lateMinutes} minutes late (within ${graceMinutes}-minute grace period). Makeup time required.`,
        lateMinutes,
        hoursDeducted: 0,
        salaryDeducted: 0,
        makeupRequired: true,
        makeupHours: lateMinutes / 60,
      };
    }

    const minutesBeyondGrace = lateMinutes - graceMinutes;
    const dailySalary = hourlyRate * workingHoursPerDay;

    // Up to 30 minutes beyond grace - 1 hour deduction
    if (minutesBeyondGrace <= 30) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'MINOR',
        description: `Arrived ${lateMinutes} minutes late (${minutesBeyondGrace} minutes beyond grace period). 1 hour salary deduction.`,
        lateMinutes,
        hoursDeducted: 1,
        salaryDeducted: hourlyRate * 1,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // Up to 90 minutes beyond grace - 3 hours deduction
    if (minutesBeyondGrace <= 90) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'MODERATE',
        description: `Arrived ${lateMinutes} minutes late (${minutesBeyondGrace} minutes beyond grace period). 3 hours salary deduction.`,
        lateMinutes,
        hoursDeducted: 3,
        salaryDeducted: hourlyRate * 3,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // Up to 150 minutes beyond grace - half day deduction
    if (minutesBeyondGrace <= 150) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'MAJOR',
        description: `Arrived ${lateMinutes} minutes late (${minutesBeyondGrace} minutes beyond grace period). Half day salary deduction.`,
        lateMinutes,
        hoursDeducted: workingHoursPerDay / 2,
        salaryDeducted: dailySalary * 0.5,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // Beyond 150 minutes - full day deduction
    return {
      penaltyType: 'LATE_ARRIVAL',
      severity: 'FULL_DAY',
      description: `Arrived ${lateMinutes} minutes late (${minutesBeyondGrace} minutes beyond grace period). Full day considered unpaid.`,
      lateMinutes,
      hoursDeducted: workingHoursPerDay,
      salaryDeducted: dailySalary,
      makeupRequired: false,
      makeupHours: 0,
    };
  }

  /**
   * Calculate early departure penalty
   */
  private calculateEarlyDeparturePenalty(
    checkOut: Date,
    checkIn: Date,
    workingHoursPerDay: number,
    hourlyRate: number
  ) {
    const hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    const expectedHours = workingHoursPerDay;
    
    if (hoursWorked >= expectedHours) {
      return null; // Worked full hours or more
    }

    const shortfallHours = expectedHours - hoursWorked;
    const earlyMinutes = Math.round(shortfallHours * 60);

    // If shortfall is significant (more than 15 minutes), apply penalty
    if (shortfallHours > 0.25) { // More than 15 minutes
      return {
        penaltyType: 'EARLY_DEPARTURE',
        severity: 'MINOR',
        description: `Left ${earlyMinutes} minutes early. ${shortfallHours.toFixed(2)} hours salary deduction.`,
        earlyMinutes,
        missedHours: shortfallHours,
        hoursDeducted: shortfallHours,
        salaryDeducted: hourlyRate * shortfallHours,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    return null;
  }

  /**
   * Apply penalties to attendance record
   */
  async applyPenaltiesToAttendance(
    attendanceId: number,
    calculationResult: PenaltyCalculationResult
  ) {
    // First, remove any existing active penalties for this attendance record to avoid duplicates
    await prisma.attendancePenalty.deleteMany({
      where: {
        attendanceId,
        isActive: true,
      },
    });

    // Update attendance record with penalty summary
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        totalPenaltyAmount: calculationResult.totalSalaryDeducted,
        makeupTimeRequired: calculationResult.totalMakeupHours,
        isPaidDay: calculationResult.isPaidDay,
      },
    });

    // Create individual penalty records
    for (const penalty of calculationResult.penalties) {
      await prisma.attendancePenalty.create({
        data: {
          attendanceId,
          penaltyType: penalty.penaltyType,
          severity: penalty.severity,
          description: penalty.description,
          lateMinutes: penalty.lateMinutes,
          earlyMinutes: penalty.earlyMinutes,
          missedHours: penalty.missedHours,
          hoursDeducted: penalty.hoursDeducted,
          salaryDeducted: penalty.salaryDeducted,
          makeupRequired: penalty.makeupRequired,
          makeupHours: penalty.makeupHours,
        },
      });
    }
  }

  /**
   * Get system settings for penalty calculation
   */
  static async getSystemSettings() {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      throw new Error('System settings not found');
    }
    return settings;
  }
}

/**
 * Process attendance and calculate penalties
 */
export async function processAttendanceWithPenalties(
  attendanceId: number,
  employeeId: number,
  checkIn: Date,
  checkOut: Date | null
) {
  const settings = await PenaltyCalculator.getSystemSettings();
  
  // Get employee hourly rate
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { hourlyRate: true, paymentBasis: true },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const calculator = new PenaltyCalculator(settings);
  
  const result = await calculator.calculatePenalties(
    employeeId,
    checkIn,
    checkOut,
    settings.workingHoursStart,
    settings.workingHoursPerDay,
    employee.hourlyRate
  );

  await calculator.applyPenaltiesToAttendance(attendanceId, result);

  return result;
} 