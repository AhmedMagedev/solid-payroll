import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { utcToEgyptTime } from '@/lib/timezone';

interface AttendanceRecord {
  checkIn: string | null;
  checkOut: string | null;
  date: string;
  isPaidDay?: boolean;
}

interface SystemSettings {
  workingHoursStart: string;
  workingHoursEnd: string;
  lateAllowanceMinutes: number;
}

interface Penalty {
  type: string;
  label: string;
  color: string;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'GRACE_PERIOD':
      return 'bg-yellow-100 text-yellow-800';
    case 'MINOR':
      return 'bg-orange-100 text-orange-800';
    case 'MODERATE':
      return 'bg-red-100 text-red-800';
    case 'MAJOR':
      return 'bg-purple-100 text-purple-800';
    case 'FULL_DAY':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
}

function formatPenaltyLabel(penalty: { severity: string; penaltyType: string; lateMinutes?: number | null; description: string }): string {
  switch (penalty.severity) {
    case 'GRACE_PERIOD':
      return `${penalty.lateMinutes} minutes makeup time`;
    case 'MINOR':
      if (penalty.penaltyType === 'LATE_ARRIVAL') {
        return '30 min penalty';
      } else {
        return 'Early departure penalty';
      }
    case 'MODERATE':
      return '90 min penalty';
    case 'MAJOR':
      return 'Half day penalty';
    case 'FULL_DAY':
      return 'Unpaid day';
    default:
      return penalty.description;
  }
}

function calculatePenalties(record: AttendanceRecord, systemSettings: SystemSettings): Penalty[] {
  const penalties: Penalty[] = [];
  if (!record.checkIn || !record.date || !systemSettings) return penalties;
  try {
    const recordDate = utcToEgyptTime(record.date);
    const checkInTime = record.checkIn ? utcToEgyptTime(record.checkIn) : null;
    const checkOutTime = record.checkOut ? utcToEgyptTime(record.checkOut) : null;
    const [startHours, startMinutes] = systemSettings.workingHoursStart.split(':');
    const [endHours, endMinutes] = systemSettings.workingHoursEnd.split(':');
    const workStart = new Date(recordDate);
    workStart.setHours(parseInt(startHours), parseInt(startMinutes) + systemSettings.lateAllowanceMinutes, 0, 0);
    const workEnd = new Date(recordDate);
    workEnd.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
    if (record.isPaidDay === false) {
      penalties.push({ type: 'unpaid', label: 'Unpaid Day', color: 'bg-red-100 text-red-800' });
      return penalties;
    }
    if (checkInTime && checkInTime > workStart) {
      const lateMinutes = (checkInTime.getTime() - workStart.getTime()) / 60000;
      const lateHours = lateMinutes / 60;
      if (lateHours >= 2.5) {
        penalties.push({ type: 'late-full', label: 'Whole Day Unpaid', color: 'bg-red-100 text-red-800' });
      } else if (lateHours >= 1.5) {
        penalties.push({ type: 'late-half', label: 'Half Day Penalty', color: 'bg-orange-100 text-orange-800' });
      } else if (lateHours >= 0.5) {
        penalties.push({ type: 'late-2h', label: '2h Late Penalty', color: 'bg-yellow-100 text-yellow-800' });
      }
    }
    if (checkOutTime && checkOutTime < workEnd) {
      const earlyMinutes = (workEnd.getTime() - checkOutTime.getTime()) / 60000;
      const earlyHours = earlyMinutes / 60;
      if (earlyHours >= 2) {
        penalties.push({ type: 'early-half', label: 'Half Day Early Penalty', color: 'bg-purple-100 text-purple-800' });
      } else if (earlyHours >= 1) {
        penalties.push({ type: 'early-2h', label: '2h Early Penalty', color: 'bg-blue-100 text-blue-800' });
      }
    }
  } catch {
    // ignore
  }
  return penalties;
}

export const dynamic = 'force-dynamic'; // Ensure the route is treated as dynamic

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id, 10);

    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get system settings
    const dbSettings = await prisma.systemSettings.findFirst();
    const systemSettings: SystemSettings = {
      workingHoursStart: dbSettings?.workingHoursStart || '09:00',
      workingHoursEnd: dbSettings?.workingHoursEnd || '18:00',
      lateAllowanceMinutes: dbSettings?.lateAllowanceMinutes ?? 15
    };

    // Get attendance records for the employee with penalties
    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId: employeeId,
      },
      include: {
        penalties: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Format the response with database penalties and fallback to calculated penalties
    const formattedAttendance = attendance.map(record => {
      const checkInStr = record.checkIn ? record.checkIn.toISOString() : null;
      const checkOutStr = record.checkOut ? record.checkOut.toISOString() : null;
      
             // Use database penalties - we always prefer database over legacy calculation
       let penalties: Penalty[] = [];
       
       // Check if this record was processed by the new penalty system
       // (records with totalPenaltyAmount set to 0 or higher indicate processing)
       const hasBeenProcessed = record.totalPenaltyAmount !== null;
       
       if (hasBeenProcessed) {
         // Use database penalties (may be empty array for no penalties)
         penalties = record.penalties
           .filter(p => !p.isWaived) // Only show active, non-waived penalties
           .map(p => ({
             type: p.penaltyType.toLowerCase().replace('_', '-'),
             label: formatPenaltyLabel(p),
             color: getSeverityColor(p.severity),
           }));
       } else {
         // Only use legacy calculation for truly unprocessed records
         penalties = calculatePenalties({
           checkIn: checkInStr,
           checkOut: checkOutStr,
           date: record.date.toISOString().split('T')[0],
           isPaidDay: record.isPaidDay
         }, systemSettings as SystemSettings);
       }
      
      return {
        ...record,
        date: record.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        checkIn: checkInStr,
        checkOut: checkOutStr,
        penalties,
        // Include new penalty fields
        graceMinutesUsed: record.graceMinutesUsed,
        lateMinutesBeyondGrace: record.lateMinutesBeyondGrace,
        makeupTimeRequired: record.makeupTimeRequired,
        makeupTimeCompleted: record.makeupTimeCompleted,
        totalPenaltyAmount: record.totalPenaltyAmount,
      };
    });

    return NextResponse.json(formattedAttendance);
  } catch (error) {
    console.error('Error fetching employee attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee attendance' },
      { status: 500 }
    );
  }
} 