/**
 * Bot setup script for configuring Telegram Mini App settings.
 * Run with: npm run bot:setup
 */

import { Bot } from 'grammy';
import 'dotenv/config';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Mini App viewport settings for desktop
const VIEWPORT_CONFIG = {
  // Minimum dimensions
  minWidth: 320,
  minHeight: 640,
  // Default dimensions
  defaultWidth: 440,
  defaultHeight: 956,
};

async function setup() {
  if (!BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }

  const bot = new Bot(BOT_TOKEN);

  console.log('Setting up Telegram bot...');
  console.log(`WebApp URL: ${WEBAPP_URL}`);
  console.log(`Viewport: ${VIEWPORT_CONFIG.defaultWidth}x${VIEWPORT_CONFIG.defaultHeight} (min: ${VIEWPORT_CONFIG.minWidth}x${VIEWPORT_CONFIG.minHeight})`);

  try {
    // Set the Menu Button to open the Mini App
    // Note: Telegram Bot API currently doesn't support setting viewport dimensions
    // programmatically. These must be configured via BotFather:
    // 1. Go to @BotFather
    // 2. /mybots -> Select your bot -> Bot Settings -> Menu Button
    // 3. Configure the web app URL
    // 4. For viewport settings, use /mybots -> Select bot -> Bot Settings -> Configure Mini App
    //    - Set "Web App URL"
    //    - Set dimensions under "Mini App Settings" (if available)
    //
    // The API only supports setting the menu button URL:
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Filmber',
        web_app: {
          url: `${WEBAPP_URL}/telegram`,
        },
      },
    });

    console.log('\n✅ Menu button configured successfully!');
    console.log('\n📋 To set viewport dimensions, use BotFather:');
    console.log('   1. Open @BotFather');
    console.log('   2. /mybots -> Select your bot');
    console.log('   3. Bot Settings -> Configure Mini App');
    console.log('   4. Set the following dimensions:');
    console.log(`      - Default Width: ${VIEWPORT_CONFIG.defaultWidth}`);
    console.log(`      - Default Height: ${VIEWPORT_CONFIG.defaultHeight}`);
    console.log(`      - Min Width: ${VIEWPORT_CONFIG.minWidth}`);
    console.log(`      - Min Height: ${VIEWPORT_CONFIG.minHeight}`);

    // Get bot info
    const me = await bot.api.getMe();
    console.log(`\n🤖 Bot: @${me.username}`);
  } catch (error) {
    console.error('Failed to setup bot:', error);
    process.exit(1);
  }
}

setup();
