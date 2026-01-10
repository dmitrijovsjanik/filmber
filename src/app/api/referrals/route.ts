import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthUser, unauthorized, success } from '@/lib/auth/middleware';
import { eq, desc } from 'drizzle-orm';
import { getReferralLink } from '@/lib/referral/utils';

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'filmber_app_bot';

interface Referral {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  referredAt: string;
}

interface ReferralStatsResponse {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  referrals: Referral[];
}

// GET /api/referrals - Get user's referral stats and list
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  // Get list of referred users
  const referrals = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.telegramUsername,
      photoUrl: users.photoUrl,
      referredAt: users.referredAt,
    })
    .from(users)
    .where(eq(users.referredById, user.id))
    .orderBy(desc(users.referredAt));

  const response: ReferralStatsResponse = {
    referralCode: user.referralCode ?? null,
    referralLink: user.referralCode ? getReferralLink(user.referralCode, BOT_USERNAME) : null,
    totalReferrals: referrals.length,
    referrals: referrals.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      username: r.username,
      photoUrl: r.photoUrl,
      referredAt: r.referredAt?.toISOString() || '',
    })),
  };

  return success(response);
}
