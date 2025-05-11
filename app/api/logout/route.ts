import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  console.log('[API Logout] Received logout request');
  try {
    const cookieStore = await cookies();
    cookieStore.delete('auth_session');
    console.log('[API Logout] Session cookie deleted');
    
    // Redirect to login page
    // Using an absolute URL is safer for redirects, especially from API routes.
    const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });

  } catch (error) {
    console.error('[API Logout] Error during logout:', error);
    // Even if an error occurs, try to redirect to login
    const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }
} 