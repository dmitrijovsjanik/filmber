import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@/lib/db/schema';
import { getAuthUser, forbidden, unauthorized } from './middleware';

/**
 * Check if user is an admin based on ADMIN_TELEGRAM_IDS env variable
 */
export function isAdmin(user: User): boolean {
  const adminIdsEnv = process.env.ADMIN_TELEGRAM_IDS;
  if (!adminIdsEnv) {
    return false;
  }

  const adminIds = adminIdsEnv.split(',').map((id) => parseInt(id.trim(), 10));
  return adminIds.includes(Number(user.telegramId));
}

/**
 * Get authenticated admin user from request
 * Returns null if not authenticated or not an admin
 */
export async function getAdminUser(request: NextRequest): Promise<User | null> {
  const user = await getAuthUser(request);
  if (!user) {
    return null;
  }

  if (!isAdmin(user)) {
    return null;
  }

  return user;
}

/**
 * Higher-order function to require admin access for an API route
 */
export function withAdmin<T extends unknown[]>(
  handler: (request: NextRequest, user: User, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const user = await getAuthUser(request);

    if (!user) {
      return unauthorized('Authentication required');
    }

    if (!isAdmin(user)) {
      return forbidden('Admin access required');
    }

    return handler(request, user, ...args);
  };
}
