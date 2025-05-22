import { prisma } from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';

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

    // Get the cookie store
    const cookieStore = await cookies();
    
    // Set the auth session cookie with production-friendly settings
    cookieStore.set('auth_session', user.username, {
      // Core settings
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      
      // Security settings - production compatible
      httpOnly: true,
      secure: true, // Always use secure cookies for HTTPS
      sameSite: 'none', // Allow cross-site cookies for production domain
    });
    
    console.log(`[API Login] Session cookie set for user: ${username} with production-safe settings`);
    console.log(`[API Login] Cookie details: path=/, secure=true, sameSite=none, httpOnly=true`);

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });

  } catch (error) {
    console.error('[API Login] Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 