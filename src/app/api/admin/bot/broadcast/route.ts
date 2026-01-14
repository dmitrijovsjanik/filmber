import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { gte, sql } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success, badRequest } from '@/lib/auth/middleware';

// Rate limiting - simple in-memory store (resets on server restart)
let lastBroadcastTime = 0;
const BROADCAST_COOLDOWN = 60 * 1000; // 1 minute

export const POST = withAdmin(async (request: NextRequest) => {
  // Check rate limit
  const now = Date.now();
  if (now - lastBroadcastTime < BROADCAST_COOLDOWN) {
    const waitSeconds = Math.ceil((BROADCAST_COOLDOWN - (now - lastBroadcastTime)) / 1000);
    return badRequest(`Please wait ${waitSeconds} seconds before sending another broadcast`);
  }

  const body = await request.json();
  const { message, audience } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return badRequest('Message is required');
  }

  if (message.length > 4000) {
    return badRequest('Message is too long (max 4000 characters)');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return badRequest('Bot token not configured');
  }

  // Get users based on audience
  let userQuery = db.select({ telegramId: users.telegramId }).from(users);

  if (audience === 'active_7d') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    userQuery = userQuery.where(gte(users.lastSeenAt, sevenDaysAgo)) as typeof userQuery;
  } else if (audience === 'active_30d') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    userQuery = userQuery.where(gte(users.lastSeenAt, thirtyDaysAgo)) as typeof userQuery;
  }

  const targetUsers = await userQuery;

  // Update rate limit timestamp
  lastBroadcastTime = now;

  // Send messages asynchronously (don't block response)
  const results = {
    total: targetUsers.length,
    sent: 0,
    failed: 0,
  };

  // Process in batches to avoid Telegram rate limits
  const batchSize = 30;
  const delayBetweenBatches = 1000; // 1 second

  const sendMessages = async () => {
    for (let i = 0; i < targetUsers.length; i += batchSize) {
      const batch = targetUsers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          try {
            const response = await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: user.telegramId,
                  text: message,
                  parse_mode: 'HTML',
                }),
              }
            );

            if (response.ok) {
              results.sent++;
            } else {
              results.failed++;
            }
          } catch {
            results.failed++;
          }
        })
      );

      // Delay between batches
      if (i + batchSize < targetUsers.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`Broadcast completed: ${results.sent} sent, ${results.failed} failed`);
  };

  // Start sending in background
  sendMessages().catch(console.error);

  return success({
    message: 'Broadcast started',
    targetUsers: targetUsers.length,
    audience: audience || 'all',
  });
});
