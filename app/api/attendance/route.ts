import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { utcToEgyptTime } from '@/lib/timezone';

const prisma = new PrismaClient();

interface DateFilter {
  gte?: Date;
  lte?: Date;
}

interface AttendanceWhereClause {
  employeeId?: number;
  date?: DateFilter;
  employee?: {
    name?: {
      contains: string;
      mode: 'insensitive';
    };
  };
}

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

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search'); // New search parameter
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build the where clause for filtering
    const where: AttendanceWhereClause = {};
    
    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }
    
    if (startDate || endDate) {
      where.date = {};
      
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }
    
    // Add employee name search if provided
    if (search) {
      where.employee = {
        name: {
          contains: search,
          mode: 'insensitive' as const
        }
      };
    }
    
    // Get total count for pagination
    const totalCount = await prisma.attendance.count({
      where
    });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Fetch attendance records with pagination
    const attendanceRecords = await prisma.attendance.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip: offset,
      take: limit,
    });
    
    // Get system settings
    const dbSettings = await prisma.systemSettings.findFirst();
    const systemSettings: SystemSettings = {
      workingHoursStart: dbSettings?.workingHoursStart || '09:00',
      workingHoursEnd: dbSettings?.workingHoursEnd || '18:00',
      lateAllowanceMinutes: dbSettings?.lateAllowanceMinutes ?? 15
    };
    
    // Format the response
    const formattedRecords = attendanceRecords.map(record => {
      const checkInStr = record.checkIn ? record.checkIn.toISOString() : null;
      const checkOutStr = record.checkOut ? record.checkOut.toISOString() : null;
      return {
        ...record,
        date: record.date.toISOString().split('T')[0],
        checkIn: checkInStr,
        checkOut: checkOutStr,
        penalties: calculatePenalties({
          checkIn: checkInStr,
          checkOut: checkOutStr,
          date: record.date.toISOString().split('T')[0],
          isPaidDay: record.isPaidDay
        }, systemSettings)
      };
    });
    
    return NextResponse.json({
      data: formattedRecords,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, totalCount)
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching attendance records:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch attendance records', details: errorMessage },
      { status: 500 }
    );
  }
} 