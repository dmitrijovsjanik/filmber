import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getTokenFromRequest, success, unauthorized } from '@/lib/auth/middleware';
import { invalidateSession } from '@/lib/auth/session';

interface SessionResponse {
  user: {
    id: string;
    telegramId: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    languageCode: string | null;
    isPremium: boolean;
    createdAt: string;
    referralCode: string | null;
  };
}

// GET /api/auth/session - Get current session
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  const response: SessionResponse = {
    user: {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.telegramUsername,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      isPremium: user.isPremium || false,
      createdAt: user.createdAt.toISOString(),
      referralCode: user.referralCode ?? null,
    },
  };

  return success(response);
}

// DELETE /api/auth/session - Logout
export async function DELETE(request: NextRequest) {
  const token = getTokenFromRequest(request);

  if (!token) {
    return unauthorized();
  }

  await invalidateSession(token);

  // Clear the cookie
  const res = success({ success: true });
  res.cookies.delete('filmber-token');

  return res;
}
