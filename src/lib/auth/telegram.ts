import { createHmac } from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TelegramInitData {
  user: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
}

/**
 * Validates Telegram WebApp initData
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initDataString: string): TelegramInitData | null {
  if (!initDataString) {
    return null;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return null;
  }

  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');

    if (!hash) {
      return null;
    }

    // Remove hash from params for verification
    params.delete('hash');

    // Sort alphabetically and create check string
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key: HMAC_SHA256(bot_token, "WebAppData")
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

    // Calculate hash: HMAC_SHA256(data_check_string, secret_key)
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      console.error('Telegram initData hash mismatch');
      return null;
    }

    // Check auth_date (not older than 24 hours)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const maxAge = 24 * 60 * 60; // 24 hours in seconds
    if (Date.now() / 1000 - authDate > maxAge) {
      console.error('Telegram initData expired');
      return null;
    }

    // Parse user data
    const userString = params.get('user');
    if (!userString) {
      console.error('Telegram initData missing user');
      return null;
    }

    const user: TelegramUser = JSON.parse(userString);

    return {
      user,
      auth_date: authDate,
      hash,
      query_id: params.get('query_id') || undefined,
      chat_instance: params.get('chat_instance') || undefined,
      chat_type: params.get('chat_type') || undefined,
      start_param: params.get('start_param') || undefined,
    };
  } catch (error) {
    console.error('Failed to validate Telegram initData:', error);
    return null;
  }
}

/**
 * Parse initData without validation (for testing/development)
 */
export function parseInitDataUnsafe(initDataString: string): TelegramInitData | null {
  if (!initDataString) {
    return null;
  }

  try {
    const params = new URLSearchParams(initDataString);
    const userString = params.get('user');

    if (!userString) {
      return null;
    }

    const user: TelegramUser = JSON.parse(userString);

    return {
      user,
      auth_date: parseInt(params.get('auth_date') || '0', 10),
      hash: params.get('hash') || '',
      query_id: params.get('query_id') || undefined,
    };
  } catch {
    return null;
  }
}
