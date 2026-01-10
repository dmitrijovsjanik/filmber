import { randomBytes } from 'crypto';

// Characters without confusing ones (0/O, 1/I/l)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a unique 8-character referral code
 */
export function generateReferralCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

/**
 * Parse referral code from Telegram start_param
 * Expected format: ref_<CODE>
 */
export function parseReferralParam(startParam?: string): string | null {
  if (!startParam) return null;
  const match = startParam.match(/^ref_([A-Z0-9]{8})$/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Generate a Telegram deep link with referral code
 */
export function getReferralLink(referralCode: string, botUsername: string): string {
  return `https://t.me/${botUsername}?start=ref_${referralCode}`;
}

/**
 * Milestone thresholds for referral rewards
 */
export const REFERRAL_MILESTONES = [5, 10, 25, 50, 100] as const;
