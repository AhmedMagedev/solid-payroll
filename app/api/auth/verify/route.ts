import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get token from HTTP-only cookie
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      );
    }

    // Verify the token
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Return user info (without sensitive data)
    return NextResponse.json({
      success: true,
      user: {
        username: decoded.username,
        userId: decoded.userId,
        isAdmin: decoded.isAdmin,
      },
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'Authentication verification failed' },
      { status: 401 }
    );
  }
} 