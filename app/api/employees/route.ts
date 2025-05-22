import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Check for authentication
    const cookieStore = await cookies();
    const session = cookieStore.get('auth_session');
    
    if (!session) {
      console.log('[API Employees] No session found, returning unauthorized');
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
    const data = await request.json();
    
    const { name, email, position, phone, dailyRate, paymentBasis } = data;
    
    if (!name || !email || !position || !dailyRate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        position,
        phone: phone || null,
        dailyRate: parseFloat(dailyRate),
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