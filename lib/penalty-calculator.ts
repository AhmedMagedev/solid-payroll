import { prisma } from '@/app/lib/prisma';

export interface PenaltyRule {
  severity: 'GRACE_PERIOD' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'FULL_DAY';
  description: string;
  hoursDeducted?: number;
  salaryDeductionRatio?: number; // 0.5 for half day, 1.0 for full day
  makeupRequired: boolean;
}

export interface PenaltyCalculation {
  penaltyType: 'LATE_ARRIVAL' | 'EARLY_DEPARTURE' | 'MISSING_ATTENDANCE';
  severity: 'GRACE_PERIOD' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'FULL_DAY';
  description: string;
  hoursDeducted: number;
  salaryDeducted: number;
  makeupRequired: boolean;
  makeupHours: number;
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
  workingHoursEnd: string;
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
    workingHoursEnd: string,
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

    // FUNDAMENTAL RULE: Only missing check-in marks the entire day as unpaid
    if (!checkIn) {
      const dailySalary = hourlyRate * workingHoursPerDay;
      
      result.penalties.push({
        penaltyType: 'MISSING_ATTENDANCE',
        severity: 'FULL_DAY',
        description: `Missing check-in - UNPAID DAY penalty applied.`,
        hoursDeducted: workingHoursPerDay,
        salaryDeducted: dailySalary,
        makeupRequired: false,
        makeupHours: 0,
      });
      
      result.totalHoursDeducted = workingHoursPerDay;
      result.totalSalaryDeducted = dailySalary;
      result.isPaidDay = false;
      
      console.log(`[Penalty] Missing check-in - marking entire day as unpaid`);
      return result;
    }

    // CHECK FOR ZERO WORKING HOURS: If check-in and check-out are the same time (0 hours worked)
    if (checkOut && checkIn.getTime() === checkOut.getTime()) {
      const dailySalary = hourlyRate * workingHoursPerDay;
      
      result.penalties.push({
        penaltyType: 'MISSING_ATTENDANCE',
        severity: 'FULL_DAY',
        description: `Zero working hours (check-in and check-out at same time) - UNPAID DAY penalty applied.`,
        hoursDeducted: workingHoursPerDay,
        salaryDeducted: dailySalary,
        makeupRequired: false,
        makeupHours: 0,
      });
      
      result.totalHoursDeducted = workingHoursPerDay;
      result.totalSalaryDeducted = dailySalary;
      result.isPaidDay = false;
      
      console.log(`[Penalty] Zero working hours - marking entire day as unpaid`);
      return result;
    }

    // If missing check-out but have check-in, treat as incomplete data but still process
    if (!checkOut) {
      console.log(`[Penalty] Missing check-out but have check-in - treating as incomplete data`);
      // We'll process late arrival penalty if applicable, but skip early departure
      // The working hours calculation will handle the missing check-out appropriately
    }

    // If both check-in and check-out exist, proceed with normal penalty calculations
    
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

    // Calculate early departure penalty (only if not already a full day penalty and have check-out)
    if (checkOut && !result.penalties.find(p => p.severity === 'FULL_DAY')) {
      const earlyDeparturePenalty = this.calculateEarlyDeparturePenalty(
        checkOut,
        checkIn,
        workingHoursEnd,
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
    const dailySalary = hourlyRate * workingHoursPerDay;
    
    // Within grace period - requires makeup time
    if (lateMinutes <= graceMinutes) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'GRACE_PERIOD',
        description: `Late arrival by ${lateMinutes} minutes (within ${graceMinutes}-minute grace period). Makeup time required - no salary deduction.`,
        lateMinutes,
        hoursDeducted: 0, // No salary deduction for grace period
        salaryDeducted: 0,
        makeupRequired: true,
        makeupHours: lateMinutes / 60,
      };
    }

    const minutesBeyondGrace = lateMinutes - graceMinutes;

    // MINOR: 31-90 minutes beyond grace - 1 hour salary penalty
    if (minutesBeyondGrace <= 90) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'MINOR',
        description: `Late arrival by ${lateMinutes} minutes (${minutesBeyondGrace} minutes beyond grace). MINOR penalty: 1 hour salary deduction.`,
        lateMinutes,
        hoursDeducted: 1, // Hours worth of salary deducted, not actual hours
        salaryDeducted: hourlyRate * 1,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // MODERATE: 91-150 minutes beyond grace - 3 hours salary penalty
    if (minutesBeyondGrace <= 150) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'MODERATE',
        description: `Late arrival by ${lateMinutes} minutes (${minutesBeyondGrace} minutes beyond grace). MODERATE penalty: 3 hours salary deduction.`,
        lateMinutes,
        hoursDeducted: 3, // Hours worth of salary deducted, not actual hours
        salaryDeducted: hourlyRate * 3,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // MAJOR: 151-210 minutes beyond grace - half day salary penalty
    if (minutesBeyondGrace <= 210) {
      return {
        penaltyType: 'LATE_ARRIVAL',
        severity: 'MAJOR',
        description: `Late arrival by ${lateMinutes} minutes (${minutesBeyondGrace} minutes beyond grace). MAJOR penalty: Half day salary deduction.`,
        lateMinutes,
        hoursDeducted: workingHoursPerDay / 2, // Hours worth of salary deducted
        salaryDeducted: dailySalary * 0.5,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // UNPAID DAY: Beyond 210 minutes - maximum penalty for late arrival
    return {
      penaltyType: 'LATE_ARRIVAL',
      severity: 'FULL_DAY',
      description: `Late arrival by ${lateMinutes} minutes (${minutesBeyondGrace} minutes beyond grace). UNPAID DAY - maximum penalty for late arrival.`,
      lateMinutes,
      hoursDeducted: workingHoursPerDay, // Hours worth of salary deducted
      salaryDeducted: dailySalary,
      makeupRequired: false,
      makeupHours: 0,
    };
  }

  /**
   * Calculate early departure penalty based on business rules
   * NO GRACE PERIOD - penalties apply from the first minute
   */
  private calculateEarlyDeparturePenalty(
    checkOut: Date,
    checkIn: Date,
    workingHoursEnd: string,
    workingHoursPerDay: number,
    hourlyRate: number
  ) {
    const [endHour, endMinute] = workingHoursEnd.split(':').map(Number);
    
    // Set expected end time based on the check-in date (same work day)
    const expectedEndTime = new Date(checkIn);
    expectedEndTime.setHours(endHour, endMinute, 0, 0);

    const earlyMinutes = Math.max(0, Math.floor((expectedEndTime.getTime() - checkOut.getTime()) / (1000 * 60)));
    
    if (earlyMinutes === 0) {
      return null; // Left on time or later
    }

    const dailySalary = hourlyRate * workingHoursPerDay;

    // MINOR: 1-30 minutes early - 1 hour salary penalty
    if (earlyMinutes <= 30) {
      return {
        penaltyType: 'EARLY_DEPARTURE',
        severity: 'MINOR',
        description: `Early departure by ${earlyMinutes} minutes. MINOR penalty: 1 hour salary deduction.`,
        earlyMinutes,
        hoursDeducted: 1,
        salaryDeducted: hourlyRate * 1,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // MODERATE: 31-90 minutes early - 3 hours salary penalty
    if (earlyMinutes <= 90) {
      return {
        penaltyType: 'EARLY_DEPARTURE',
        severity: 'MODERATE',
        description: `Early departure by ${earlyMinutes} minutes. MODERATE penalty: 3 hours salary deduction.`,
        earlyMinutes,
        hoursDeducted: 3,
        salaryDeducted: hourlyRate * 3,
        makeupRequired: false,
        makeupHours: 0,
      };
    }

    // MAJOR: 91+ minutes early - half day penalty (maximum for early departure)
    return {
      penaltyType: 'EARLY_DEPARTURE',
      severity: 'MAJOR',
      description: `Early departure by ${earlyMinutes} minutes. MAJOR penalty: Half day salary deduction.`,
      earlyMinutes,
      hoursDeducted: workingHoursPerDay / 2,
      salaryDeducted: dailySalary * 0.5,
      makeupRequired: false,
      makeupHours: 0,
    };
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
    settings.workingHoursEnd,
    settings.workingHoursPerDay,
    employee.hourlyRate
  );

  await calculator.applyPenaltiesToAttendance(attendanceId, result);

  return result;
}

/**
 * Format penalty for display in UI
 */
export function formatPenaltyLabel(penalty: {
  penaltyType: string;
  lateMinutes?: number;
  earlyMinutes?: number;
  salaryDeducted?: number;
  makeupHours?: number;
} | null): string {
  if (!penalty) return '';
  
  const { penaltyType, lateMinutes, earlyMinutes, salaryDeducted, makeupHours } = penalty;
  
  if (penaltyType === 'LATE_ARRIVAL' && lateMinutes) {
    if (makeupHours && makeupHours > 0) {
      return `Late ${lateMinutes}min (Makeup: ${makeupHours}h)`;
    } else {
      return `Late ${lateMinutes}min (-L.E ${salaryDeducted?.toFixed(2) || '0.00'})`;
    }
  }
  
  if (penaltyType === 'EARLY_DEPARTURE' && earlyMinutes) {
    if (makeupHours && makeupHours > 0) {
      return `Early ${earlyMinutes}min (Makeup: ${makeupHours}h)`;
    } else {
      return `Early ${earlyMinutes}min (-L.E ${salaryDeducted?.toFixed(2) || '0.00'})`;
    }
  }

  if (penaltyType === 'MISSING_ATTENDANCE') {
    return `Missing attendance (-L.E ${salaryDeducted?.toFixed(2) || '0.00'})`;
  }
  
  // Fallback for any other penalty types
  return `Penalty (-L.E ${salaryDeducted?.toFixed(2) || '0.00'})`;
}