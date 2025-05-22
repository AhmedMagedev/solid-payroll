import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  console.log('[API Logout] Received logout request');
  try {
    const cookieStore = await cookies();
    
    // Delete the cookie explicitly for logout
    cookieStore.delete('auth_session');
    
    // Set an expired cookie with production-compatible settings
    cookieStore.set('auth_session', '', {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'none',
      maxAge: 0, // Expire immediately
    });
    
    console.log('[API Logout] Session cookie deleted with production-compatible settings');
    
    // Redirect to login page
    return NextResponse.redirect(new URL('/login', 'https://hr.solid-metals.com'), { 
      status: 302 
    });

  } catch (error) {
    console.error('[API Logout] Error during logout:', error);
    // Even if an error occurs, try to redirect to login
    return NextResponse.redirect(new URL('/login', 'https://hr.solid-metals.com'), { 
      status: 302 
    });
  }
} 