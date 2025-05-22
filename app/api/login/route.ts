import { prisma } from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { generateToken } from '@/app/lib/auth';

export async function POST(req: Request) {
  console.log('[API Login] Received login request');
  try {
    const { username, password } = await req.json();
    console.log(`[API Login] Attempting login for user: ${username}`);

    if (!username || !password) {
      console.log('[API Login] Missing username or password');
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      console.log(`[API Login] User not found: ${username}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    console.log(`[API Login] User found: ${username}`);

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log(`[API Login] Password mismatch for user: ${username}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    console.log(`[API Login] Password matched for user: ${username}`);

    // Generate JWT token
    const token = await generateToken({ 
      username: user.username,
      userId: user.id
    });
    
    // Get the cookie store and set token in cookie for SSR support
    const cookieStore = await cookies();
    
    // Set the auth token cookie
    cookieStore.set('auth_token', token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true,
      secure: true, 
      sameSite: 'none',
    });
    
    console.log(`[API Login] Auth token generated and cookie set for user: ${username}`);

    // Return token in response body for client-side storage
    return NextResponse.json({ 
      message: 'Login successful', 
      token
    }, { status: 200 });

  } catch (error) {
    console.error('[API Login] Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 