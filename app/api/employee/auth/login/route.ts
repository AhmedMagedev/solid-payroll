import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find employee by email
    const employee = await prisma.employee.findUnique({
      where: { 
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        isActive: true,
        canAccessPortal: true,
        position: true,
        department: true,
        profilePicture: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if employee is active and can access portal
    if (!employee.isActive || !employee.canAccessPortal) {
      return NextResponse.json(
        { error: 'Access denied. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Check if password is set
    if (!employee.password) {
      return NextResponse.json(
        { error: 'Password not set. Please contact your administrator to set up your account.' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        employeeId: employee.id,
        email: employee.email,
        type: 'employee'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' } // 8 hours session
    );

    // Update last login time
    await prisma.employee.update({
      where: { id: employee.id },
      data: { 
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    // Create session record
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 8);

    await prisma.employeeSession.create({
      data: {
        employeeId: employee.id,
        token,
        expiresAt: sessionExpiresAt,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        deviceInfo: request.headers.get('user-agent') || 'unknown',
        isActive: true,
      },
    });

    // Set HTTP-only cookie
    const response = NextResponse.json({
      message: 'Login successful',
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        position: employee.position,
        department: employee.department,
        profilePicture: employee.profilePicture,
      },
    });

    response.cookies.set('employee_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Employee login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 