import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

interface Penalty {
  type: string;
  label: string;
  color: string;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'MINOR':
      return 'bg-yellow-100 text-yellow-800';
    case 'MODERATE':
      return 'bg-orange-100 text-orange-800';
    case 'MAJOR':
      return 'bg-purple-100 text-purple-800';
    case 'FULL_DAY':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function formatPenaltyLabel(penalty: { severity: string; penaltyType: string; lateMinutes?: number | null; earlyMinutes?: number | null; description: string }): string {
  // Use the description from the penalty calculator if available
  if (penalty.description) {
    return penalty.description;
  }
  
  // Fallback formatting based on penalty type and severity
  switch (penalty.severity) {
    case 'MAKEUP':
      if (penalty.lateMinutes && penalty.lateMinutes > 0) {
        return `${penalty.lateMinutes} min makeup required`;
      }
      if (penalty.earlyMinutes && penalty.earlyMinutes > 0) {
        return `${penalty.earlyMinutes} min makeup required`;
      }
      return 'Makeup time required';
    case 'MINOR':
      if (penalty.penaltyType === 'LATE_ARRIVAL') {
        return '30 min penalty';
      } else if (penalty.penaltyType === 'EARLY_DEPARTURE') {
        return 'Early departure penalty';
      }
      return '30 min penalty';
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

    // Format the response with backend penalties only
    const formattedAttendance = attendance.map(record => {
      const checkInStr = record.checkIn ? record.checkIn.toISOString() : null;
      const checkOutStr = record.checkOut ? record.checkOut.toISOString() : null;
      
      // Calculate working hours
      let hoursWorked = 0;
      if (record.checkIn && record.checkOut) {
        const timeDifference = record.checkOut.getTime() - record.checkIn.getTime();
        hoursWorked = timeDifference / (1000 * 60 * 60); // Convert milliseconds to hours
      }
      
      // Use only backend penalties from database
      const penalties: Penalty[] = record.penalties
        .filter(p => !p.isWaived) // Only show active, non-waived penalties
        .map(p => ({
          type: p.penaltyType.toLowerCase().replace('_', '-'),
          label: formatPenaltyLabel(p),
          color: getSeverityColor(p.severity),
        }));
      
      return {
        ...record,
        date: record.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        checkIn: checkInStr,
        checkOut: checkOutStr,
        hoursWorked, // Add calculated working hours
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