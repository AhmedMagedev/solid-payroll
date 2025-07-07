import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  console.log('[API Logout] Received logout request');
  try {
    const cookieStore = await cookies();
    
    // Delete the auth token cookie
    cookieStore.delete('auth_token');
    
    // Set an expired cookie with production-compatible settings
    cookieStore.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 0, // Expire immediately
    });
    
    console.log('[API Logout] Auth token cookie deleted');
    
    // Get the base URL from the request to handle both dev and production
    const url = new URL('/login', request.url);
    
    // Redirect to login page
    return NextResponse.redirect(url, { 
      status: 302 
    });

  } catch (error) {
    console.error('[API Logout] Error during logout:', error);
    // Even if an error occurs, try to redirect to login
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url, { 
      status: 302 
    });
  }
} 