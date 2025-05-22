import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id, 10);

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

    // Get attendance records for the employee
    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId: employeeId,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching employee attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee attendance' },
      { status: 500 }
    );
  }
} 