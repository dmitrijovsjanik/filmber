import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.error('Telegram webhook: Invalid secret token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dynamic import to avoid issues in edge runtime
    const { createWebhookHandler } = await import('@/server/bot');
    const handler = createWebhookHandler();

    // Get the raw body
    const body = await request.text();

    // Create a standard Request object for grammy
    const webhookRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body,
    });

    // Handle the webhook
    const response = await handler(webhookRequest);

    return response;
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Telegram requires a quick response, so we don't want to timeout
export const maxDuration = 30;
