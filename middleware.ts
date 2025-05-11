import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

  // API routes are not processed by this middleware based on matcher, but if they were:
  // if (pathname.startsWith('/api')) {
  //   console.log(`[Middleware] Allowing API route: ${pathname}`);
  //   return NextResponse.next();
  // }

  const cookieStore = await cookies();
  const session = cookieStore.get('auth_session')?.value;
  console.log(`[Middleware] Session cookie value for ${pathname}: ${session ? session.substring(0,10) + '...' : 'not found'}`);

  // If trying to access login page
  if (pathname === '/login') {
    if (session) {
      console.log('[Middleware] User with session on login page, redirecting to dashboard.');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    console.log('[Middleware] Accessing login page (no session), allowing.');
    return NextResponse.next();
  }

  // If trying to access a protected route without a session, redirect to login
  if (!session && PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    console.log(`[Middleware] No session for protected route ${pathname}, redirecting to login.`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user has a session and tries to access the root path, redirect to dashboard
  if (session && pathname === '/') {
    console.log('[Middleware] User with session on root path, redirecting to dashboard.');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  console.log(`[Middleware] Allowing access to: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for API routes and specific static files/folders.
     * API routes are excluded by prefixing the pattern with /api.
     * Public assets in /images are also excluded.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
}; 