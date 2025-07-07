import { NextRequest } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export interface EmployeeAuthPayload {
  employeeId: number;
  email: string;
  type: string;
}

export async function verifyEmployeeToken(request: NextRequest): Promise<EmployeeAuthPayload | null> {
  try {
    const token = request.cookies.get('employee_token')?.value;
    
    if (!token) {
      return null;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as EmployeeAuthPayload;
    
    if (decoded.type !== 'employee') {
      return null;
    }

    // Check if session exists and is active in database
    const session = await prisma.employeeSession.findFirst({
      where: {
        employeeId: decoded.employeeId,
        token: token,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      return null;
    }

    // Update last seen time
    await prisma.employeeSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    // Update employee last active time
    await prisma.employee.update({
      where: { id: decoded.employeeId },
      data: { lastActiveAt: new Date() },
    });

    return decoded;
  } catch (error) {
    console.error('Employee token verification error:', error);
    return null;
  }
}

export async function getCurrentEmployee(request: NextRequest) {
  try {
    const auth = await verifyEmployeeToken(request);
    
    if (!auth) {
      return null;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: auth.employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        department: true,
        phone: true,
        profilePicture: true,
        isActive: true,
        canAccessPortal: true,
        canWorkRemotely: true,
        allowedWorkLocations: true,
        preferredLanguage: true,
        timezone: true,
        emailNotifications: true,
        lastLoginAt: true,
        lastActiveAt: true,
      },
    });

    return employee;
  } catch (error) {
    console.error('Get current employee error:', error);
    return null;
  }
} 