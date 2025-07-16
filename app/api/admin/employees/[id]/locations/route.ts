import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid employee ID' },
        { status: 400 }
      );
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Get current location assignments
    const assignments = await prisma.employeeWorkLocation.findMany({
      where: {
        employeeId: id,
        isActive: true,
      },
      include: {
        workLocation: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error('Error fetching employee locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee locations' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid employee ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { assignments, primaryLocationId } = body;

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Validate assignments array
    if (!Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Assignments must be an array' },
        { status: 400 }
      );
    }

    // Validate each assignment
    for (const assignment of assignments) {
      if (!assignment.workLocationId || typeof assignment.workLocationId !== 'number') {
        return NextResponse.json(
          { error: 'Each assignment must have a valid workLocationId' },
          { status: 400 }
        );
      }

      // Check if location exists
      const location = await prisma.workLocation.findUnique({
        where: { id: assignment.workLocationId },
      });

      if (!location) {
        return NextResponse.json(
          { error: `Work location with ID ${assignment.workLocationId} not found` },
          { status: 400 }
        );
      }
    }

    // Validate primary location if provided
    if (primaryLocationId !== null && primaryLocationId !== undefined) {
      const primaryLocation = await prisma.workLocation.findUnique({
        where: { id: primaryLocationId },
      });

      if (!primaryLocation) {
        return NextResponse.json(
          { error: 'Primary location not found' },
          { status: 400 }
        );
      }
    }

    // Use transaction to update everything atomically
    await prisma.$transaction(async (tx) => {
      // Remove all existing assignments for this employee
      await tx.employeeWorkLocation.deleteMany({
        where: {
          employeeId: id,
        },
      });

      // Create new assignments
      if (assignments.length > 0) {
        await tx.employeeWorkLocation.createMany({
          data: assignments.map((assignment: { workLocationId: number; canCheckIn?: boolean; canCheckOut?: boolean }) => ({
            employeeId: id,
            workLocationId: assignment.workLocationId,
            canCheckIn: assignment.canCheckIn ?? true,
            canCheckOut: assignment.canCheckOut ?? true,
            isActive: true,
            assignedBy: 'admin', // TODO: Get from session
          })),
        });
      }

      // Update employee's primary location
      await tx.employee.update({
        where: { id },
        data: {
          primaryWorkLocationId: primaryLocationId || null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Location assignments updated successfully',
    });
  } catch (error) {
    console.error('Error updating employee locations:', error);
    return NextResponse.json(
      { error: 'Failed to update location assignments' },
      { status: 500 }
    );
  }
} 