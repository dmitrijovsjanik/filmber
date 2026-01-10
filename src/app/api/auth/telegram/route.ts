import { NextRequest, NextResponse } from 'next/server';
import { validateInitData, parseInitDataUnsafe } from '@/lib/auth/telegram';
import { findOrCreateUser, createSession } from '@/lib/auth/session';
import { badRequest, success } from '@/lib/auth/middleware';

interface AuthRequest {
  initData: string;
}

interface AuthResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    telegramId: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    languageCode: string | null;
    referralCode: string | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AuthRequest = await request.json();

    if (!body.initData) {
      return badRequest('initData is required');
    }

    // Validate initData (in development, allow unsafe parsing for testing)
    const isDev = process.env.NODE_ENV !== 'production';
    const initData = isDev
      ? parseInitDataUnsafe(body.initData) || validateInitData(body.initData)
      : validateInitData(body.initData);

    if (!initData) {
      return badRequest('Invalid initData');
    }

    // Find or create user (pass start_param for referral tracking)
    const user = await findOrCreateUser(initData.user, initData.start_param);

    // Create session
    const deviceInfo = JSON.stringify({
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    const session = await createSession(user, deviceInfo);

    const response: AuthResponse = {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.telegramUsername,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        referralCode: user.referralCode ?? null,
      },
    };

    // Set token as HTTP-only cookie as well
    const res = success(response);
    res.cookies.set('filmber-token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
