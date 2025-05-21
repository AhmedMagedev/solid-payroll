import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

// Handler for GET requests
export async function GET(request: NextRequest) {
  // Get id from pathname (last segment)
  const pathname = request.nextUrl.pathname;
  const id = pathname.split('/').pop();
  
  if (!id) {
    return NextResponse.json({ error: 'ID parameter missing' }, { status: 400 });
  }

  try {
    const employeeId = parseInt(id, 10);
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

// Handler for DELETE requests
export async function DELETE(request: NextRequest) {
  // Get id from pathname (last segment)
  const pathname = request.nextUrl.pathname;
  const id = pathname.split('/').pop();
  
  if (!id) {
    return NextResponse.json({ error: 'ID parameter missing' }, { status: 400 });
  }

  try {
    const employeeId = parseInt(id, 10);
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    await prisma.employee.delete({
      where: { id: employeeId },
    });
    
    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}

/*
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

// Official Next.js 15 syntax for dynamic route parameters
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id, 10);

    if (isNaN(employeeId)) {
      return NextResponse.json({ message: 'Invalid employee ID' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('[API] Failed to fetch employee:', error);
    return NextResponse.json(
      { message: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id, 10);

    if (isNaN(employeeId)) {
      return NextResponse.json({ message: 'Invalid employee ID' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ message: 'Employee not found' }, { status: 404 });
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('[API] Failed to delete employee:', error);
    return NextResponse.json(
      { message: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
*/ 