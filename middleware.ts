import { NextRequest, NextResponse } from 'next/server';

// Define route patterns
const ADMIN_ROUTES = ['/dashboard', '/api/employees', '/api/attendance', '/api/payouts', '/api/users', '/api/settings', '/api/auth/verify', '/api/admin'];
const EMPLOYEE_ROUTES = ['/employee/dashboard', '/employee/profile', '/employee/attendance'];
const EMPLOYEE_API_ROUTES = ['/api/employee/profile', '/api/employee/attendance'];
const PUBLIC_ROUTES = ['/login', '/admin/login', '/employee/login'];
const PUBLIC_API_ROUTES = ['/api/login', '/api/logout', '/api/employee/auth/login', '/api/employee/auth/logout'];
const EMPLOYEE_LANDING = '/employee';
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

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    console.log(`[Middleware] Allowing public route: ${pathname}`);
    return NextResponse.next();
  }

  // Allow public API routes (authentication endpoints)
  if (PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    console.log(`[Middleware] Allowing public API route: ${pathname}`);
    return NextResponse.next();
  }

  // Allow employee landing page
  if (pathname === EMPLOYEE_LANDING) {
    console.log(`[Middleware] Allowing employee landing page: ${pathname}`);
    return NextResponse.next();
  }

  // Handle employee routes - just check if token exists
  if (EMPLOYEE_ROUTES.some(route => pathname.startsWith(route)) || 
      EMPLOYEE_API_ROUTES.some(route => pathname.startsWith(route))) {
    
    const employeeToken = request.cookies.get('employee_token')?.value;
    console.log(`[Middleware] Employee route ${pathname}, token exists: ${!!employeeToken}`);
    
    if (!employeeToken) {
      console.log(`[Middleware] No employee token for employee route ${pathname}, redirecting to employee login.`);
      return NextResponse.redirect(new URL('/employee/login', request.url));
    }
    
    console.log(`[Middleware] Employee token present for: ${pathname}`);
    return NextResponse.next();
  }

  // Handle admin routes - just check if token exists
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route)) || pathname === '/') {
    const adminToken = request.cookies.get('auth_token')?.value;
    
    if (!adminToken) {
      console.log(`[Middleware] No admin token for admin route ${pathname}, redirecting to login selection.`);
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // If accessing root with admin token, redirect to dashboard
    if (pathname === '/') {
      console.log('[Middleware] Admin with token on root path, redirecting to dashboard.');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    console.log(`[Middleware] Admin token present for: ${pathname}`);
    return NextResponse.next();
  }

  // Handle login page redirects for users with tokens
  if (pathname === '/admin/login') {
    const adminToken = request.cookies.get('auth_token')?.value;
    
    if (adminToken) {
      console.log('[Middleware] Admin with token on admin login page, redirecting to dashboard.');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/employee/login') {
    const employeeToken = request.cookies.get('employee_token')?.value;
    
    if (employeeToken) {
      console.log('[Middleware] Employee with token on employee login page, redirecting to employee dashboard.');
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Default: allow the request to proceed
  console.log(`[Middleware] Allowing access to: ${pathname}`);
  return NextResponse.next();
}

// Define which paths this middleware should run on
export const config = {
  matcher: [
    // Match all request paths except for the API routes that handle their own auth
    '/((?!api/login|api/logout).*)',
  ],
}; 