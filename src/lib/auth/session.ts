import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import { users, userSessions, type User, type NewUser } from '@/lib/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import type { TelegramUser } from './telegram';
import { generateReferralCode, parseReferralParam } from '@/lib/referral/utils';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY_DAYS = 30;

export interface SessionPayload {
  userId: string;
  telegramId: number;
  sessionId: string;
}

/**
 * Generate a random session token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a JWT from session payload
 */
function createJWT(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${TOKEN_EXPIRY_DAYS}d`,
  });
}

/**
 * Verify and decode a JWT
 */
export function verifyJWT(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Find or create a user from Telegram data
 * @param telegramUser - User data from Telegram
 * @param startParam - Optional start_param from Telegram deep link (for referrals)
 */
export async function findOrCreateUser(
  telegramUser: TelegramUser,
  startParam?: string
): Promise<User> {
  // Try to find existing user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramUser.id));

  if (existingUser) {
    // Update user data (name, username, photo may have changed)
    // Note: We do NOT update referredById - only set on first registration
    const [updatedUser] = await db
      .update(users)
      .set({
        telegramUsername: telegramUser.username || null,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name || null,
        photoUrl: telegramUser.photo_url || null,
        languageCode: telegramUser.language_code || null,
        isPremium: telegramUser.is_premium || false,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    return updatedUser;
  }

  // Parse referral code from start_param
  const referralCode = parseReferralParam(startParam);
  let referrerId: string | null = null;

  if (referralCode) {
    // Find the referrer by their referral code
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, referralCode));

    if (referrer) {
      referrerId = referrer.id;
    }
  }

  // Create new user with referral data
  const newUser: NewUser = {
    telegramId: telegramUser.id,
    telegramUsername: telegramUser.username || null,
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name || null,
    photoUrl: telegramUser.photo_url || null,
    languageCode: telegramUser.language_code || null,
    isPremium: telegramUser.is_premium || false,
    lastSeenAt: new Date(),
    referralCode: generateReferralCode(),
    referredById: referrerId,
    referredAt: referrerId ? new Date() : null,
  };

  try {
    const [createdUser] = await db.insert(users).values(newUser).returning();
    return createdUser;
  } catch (error: unknown) {
    // Handle race condition - user was created by another request
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      // Check if it's a referral_code collision (rare but possible)
      if ('constraint' in error && String(error.constraint).includes('referral_code')) {
        // Regenerate referral code and try again
        newUser.referralCode = generateReferralCode();
        const [createdUser] = await db.insert(users).values(newUser).returning();
        return createdUser;
      }

      // It's a telegramId collision - user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramUser.id));
      if (existingUser) {
        return existingUser;
      }
    }
    throw error;
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(
  user: User,
  deviceInfo?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const [session] = await db
    .insert(userSessions)
    .values({
      userId: user.id,
      tokenHash,
      deviceInfo: deviceInfo || null,
      expiresAt,
    })
    .returning();

  // Create JWT with session info
  const jwtToken = createJWT({
    userId: user.id,
    telegramId: user.telegramId,
    sessionId: session.id,
  });

  return { token: jwtToken, expiresAt };
}

/**
 * Validate a session token and return the user
 */
export async function validateSession(token: string): Promise<User | null> {
  const payload = verifyJWT(token);
  if (!payload) {
    return null;
  }

  // Verify session exists and is not expired
  const [session] = await db
    .select()
    .from(userSessions)
    .where(
      and(eq(userSessions.id, payload.sessionId), gt(userSessions.expiresAt, new Date()))
    );

  if (!session) {
    return null;
  }

  // Get and update user
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId));

  if (!user) {
    return null;
  }

  // Update last used time
  await db
    .update(userSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(userSessions.id, session.id));

  // Update user last seen
  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, user.id));

  return user;
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(token: string): Promise<boolean> {
  const payload = verifyJWT(token);
  if (!payload) {
    return false;
  }

  // Check if session exists first
  const [existing] = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(eq(userSessions.id, payload.sessionId));

  if (!existing) {
    return false;
  }

  await db.delete(userSessions).where(eq(userSessions.id, payload.sessionId));

  return true;
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
}

/**
 * Clean up expired sessions (can be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();

  // Count expired sessions first (expiresAt < now means expired)
  const expired = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(lt(userSessions.expiresAt, now));

  if (expired.length === 0) {
    return 0;
  }

  // Delete expired sessions
  await db.delete(userSessions).where(lt(userSessions.expiresAt, now));

  return expired.length;
}
