import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('employee_token')?.value;

    if (token) {
      try {
        // Decode token to get employee info
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { employeeId: number; email: string; type: string };
        
        // Deactivate session in database
        await prisma.employeeSession.updateMany({
          where: {
            employeeId: decoded.employeeId,
            token: token,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });
      } catch (error) {
        // Token invalid or expired, continue with logout
        console.log('Token verification failed during logout:', error);
      }
    }

    // Clear the cookie
    const response = NextResponse.json({ message: 'Logged out successfully' });
    
    response.cookies.set('employee_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Employee logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 