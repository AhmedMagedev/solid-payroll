import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      console.log('[API Employees] No token found, returning unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      console.log('[API Employees] Invalid token, returning unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const employees = await prisma.employee.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }
    
    const data = await request.json();
    
    const { name, email, position, phone, fingerprintId, hourlyRate, paymentBasis } = data;

  if (!name || !position || !hourlyRate || !fingerprintId) {
    return NextResponse.json(
      { error: 'Missing required fields (name, position, hourlyRate, fingerprintId)' },
      { status: 400 }
    );
  }
    
    // Check if fingerprintId is already taken
    const existingEmployee = await prisma.employee.findFirst({
      where: { fingerprintId },
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Fingerprint Device ID is already in use by another employee' },
        { status: 400 }
      );
    }
    
    const employee = await prisma.employee.create({
      data: {
        name,
        email: email || null,
        position,
        phone: phone || null,
        fingerprintId,
        hourlyRate: parseFloat(hourlyRate),
        paymentBasis: paymentBasis || 'Monthly',
      },
    });
    
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
} 