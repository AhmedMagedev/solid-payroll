import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

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
        penalties: {
          where: {
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      skip: offset,
      take: limit,
    });
    
    // Format the response with backend penalties only
    const formattedRecords = attendanceRecords.map(record => {
      const checkInStr = record.checkIn ? record.checkIn.toISOString() : null;
      const checkOutStr = record.checkOut ? record.checkOut.toISOString() : null;
      
      // Use only backend penalties from database
      const penalties = record.penalties
        .filter(p => !p.isWaived) // Only show active, non-waived penalties
        .map(p => ({
          type: p.penaltyType.toLowerCase().replace('_', '-'),
          label: p.description,
          color: getSeverityColor(p.severity),
        }));
      
      return {
        ...record,
        date: record.date.toISOString().split('T')[0],
        checkIn: checkInStr,
        checkOut: checkOutStr,
        penalties
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