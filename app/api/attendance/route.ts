import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient();

interface DateFilter {
  gte?: Date;
  lte?: Date;
}

interface AttendanceWhereClause {
  employeeId?: number;
  date?: DateFilter;
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
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
    
    // Fetch attendance records with employee information
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
      take: 100, // Limit to 100 records
    });
    
    // Format the response
    const formattedRecords = attendanceRecords.map(record => ({
      id: record.id,
      employeeId: record.employeeId,
      employeeName: record.employee.name,
      date: record.date,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      hoursWorked: record.hoursWorked,
    }));
    
    return NextResponse.json(formattedRecords);
  } catch (error: unknown) {
    console.error('Error fetching attendance records:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch attendance records', details: errorMessage },
      { status: 500 }
    );
  }
} 