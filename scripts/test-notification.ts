/**
 * Test script to send a notification via the bot
 * Usage: npx tsx scripts/test-notification.ts <telegramId>
 */

import 'dotenv/config';
import { Bot } from 'grammy';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  const telegramId = process.argv[2];

  if (!telegramId) {
    console.error('Usage: npx tsx scripts/test-notification.ts <telegramId>');
    process.exit(1);
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set in .env');
    process.exit(1);
  }

  const bot = new Bot(TELEGRAM_BOT_TOKEN);

  const testMessage = `
🎬 <b>Test Notification</b>

This is a test message from Filmber's upcoming movies notification system.

If you see this, the bot is working correctly!

<i>Sent at: ${new Date().toISOString()}</i>
`.trim();

  try {
    await bot.api.sendMessage(telegramId, testMessage, {
      parse_mode: 'HTML',
    });
    console.log(`✅ Message sent to ${telegramId}`);
  } catch (error) {
    console.error('❌ Failed to send message:', error);
  }
}

main();
