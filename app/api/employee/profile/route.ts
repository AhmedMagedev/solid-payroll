import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { getCurrentEmployee } from '@/app/lib/employee-auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        position: employee.position,
        department: employee.department,
        phone: employee.phone,
        profilePicture: employee.profilePicture,
        canWorkRemotely: employee.canWorkRemotely,
        allowedWorkLocations: employee.allowedWorkLocations,
        preferredLanguage: employee.preferredLanguage,
        timezone: employee.timezone,
        emailNotifications: employee.emailNotifications,
        lastLoginAt: employee.lastLoginAt,
        lastActiveAt: employee.lastActiveAt,
      },
    });
  } catch (error) {
    console.error('Employee profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name, phone, preferredLanguage, timezone, emailNotifications } = await request.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Update employee profile
    const updatedEmployee = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        name,
        phone,
        preferredLanguage: preferredLanguage || 'en',
        timezone: timezone || 'UTC',
        emailNotifications: emailNotifications || false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        department: true,
        phone: true,
        profilePicture: true,
        canWorkRemotely: true,
        allowedWorkLocations: true,
        preferredLanguage: true,
        timezone: true,
        emailNotifications: true,
        lastLoginAt: true,
        lastActiveAt: true,
      },
    });

    return NextResponse.json({
      message: 'Profile updated successfully',
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error('Employee profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 