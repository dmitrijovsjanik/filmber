import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from './session';
import type { User } from '@/lib/db/schema';

/**
 * Extract auth token from request
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie
  const tokenCookie = request.cookies.get('filmber-token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  return null;
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request: NextRequest): Promise<User | null> {
  const token = getTokenFromRequest(request);
  if (!token) {
    return null;
  }

  return validateSession(token);
}

/**
 * Higher-order function to require authentication for an API route
 */
export function withAuth<T extends unknown[]>(
  handler: (request: NextRequest, user: User, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(request, user, ...args);
  };
}

/**
 * Create an unauthorized response
 */
export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create a forbidden response
 */
export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Create a bad request response
 */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Create a not found response
 */
export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Create a success response with JSON data
 */
export function success<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
