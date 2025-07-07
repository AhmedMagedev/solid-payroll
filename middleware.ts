import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';

const PROTECTED_ROUTES = ['/dashboard', '/dashboard/employees', '/']; // Root is also protected
const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Request for: ${pathname}`);

  // Allow public files (images, css, js, etc.) and Next.js internals
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/static') || 
    pathname.startsWith('/images') || 
    PUBLIC_FILE.test(pathname)
  ) {
    console.log(`[Middleware] Allowing public asset: ${pathname}`);
    return NextResponse.next();
  }

  // Get auth token from cookies or Authorization header
  let token = request.cookies.get('auth_token')?.value;
  
  // Check Authorization header if no cookie token
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  // Verify token if present
  const session = token ? await verifyToken(token) : null;
  
  // Log minimal info for debugging
  if (session) {
    console.log(`[Middleware] Valid token found for: ${pathname}`);
  }

  // If trying to access login page
  if (pathname === '/login') {
    if (session) {
      console.log('[Middleware] User with valid token on login page, redirecting to dashboard.');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    console.log('[Middleware] Accessing login page (no token), allowing.');
    return NextResponse.next();
  }

  // If trying to access a protected route without a valid token, redirect to login
  if (!session && PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    console.log(`[Middleware] No valid token for protected route ${pathname}, redirecting to login.`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user has a valid token and tries to access the root path, redirect to dashboard
  if (session && pathname === '/') {
    console.log('[Middleware] User with valid token on root path, redirecting to dashboard.');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  console.log(`[Middleware] Allowing access to: ${pathname}`);
  return NextResponse.next();
}

// Define which paths this middleware should run on
export const config = {
  matcher: [
    // Match all request paths except for API routes that handle their own auth
    '/((?!api/(?!employees|attendance)).*)',
  ],
}; 