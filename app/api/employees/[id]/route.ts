import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

interface Params {
  params: { id: string };
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const employeeId = parseInt(params.id, 10);

    if (isNaN(employeeId)) {
      return NextResponse.json({ message: 'Invalid employee ID' }, { status: 400 });
    }

    // Check if employee exists (optional, prisma.delete errors if not found by default)
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

    return NextResponse.json({ message: 'Employee deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('[API] Failed to delete employee:', error);
    // Prisma error for record not found can be P2025
    // if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    //   return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
    // }
    return NextResponse.json({ message: 'Failed to delete employee', error: (error as Error).message }, { status: 500 });
  }
}

// Later, we will add PUT/PATCH here for editing. 