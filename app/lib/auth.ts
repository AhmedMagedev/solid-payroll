import { jwtVerify, SignJWT, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// Secret key for JWT - should be in environment variables in production
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'solid-payroll-jwt-secret-key'
);

// Token expiration time (30 days in seconds)
const TOKEN_EXPIRATION = 60 * 60 * 24 * 30;

// Define our token payload interface extending JWTPayload
export interface TokenPayload extends JWTPayload {
  username: string;
  userId?: number;
}

/**
 * Generate a JWT token for the authenticated user
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  const token = await new SignJWT({
    username: payload.username,
    userId: payload.userId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRATION}s`)
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Ensure payload has the required properties
    if (typeof payload.username !== 'string') {
      return null;
    }
    return payload as TokenPayload;
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return null;
  }
}

/**
 * Get token from request headers or cookies
 */
export async function getTokenFromRequest(request: Request): Promise<string | null> {
  // Try to get from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fall back to cookie
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

/**
 * Get token from NextRequest cookies or headers
 */
export function getTokenFromNextRequest(request: { cookies: { get: (name: string) => { value: string } | undefined }, headers: Headers }): string | null {
  // Try to get from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fall back to cookie
  return request.cookies.get('auth_token')?.value || null;
}

/**
 * Validate user session from request
 */
export async function validateSession(request: Request): Promise<TokenPayload | null> {
  const token = await getTokenFromRequest(request);
  if (!token) return null;
  
  return await verifyToken(token);
}

/**
 * Validate user session from NextRequest
 */
export async function validateNextSession(request: { cookies: { get: (name: string) => { value: string } | undefined }, headers: Headers }): Promise<TokenPayload | null> {
  const token = getTokenFromNextRequest(request);
  if (!token) return null;
  
  return await verifyToken(token);
} 