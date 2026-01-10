import { config } from 'dotenv';
// Load .env.local in development, .env in production (symlinked from shared/.env)
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
config({ path: envFile });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../src/types/socket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, turbopack: false });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Dynamic import to ensure DATABASE_URL is available
  const { setupSocketHandlers } = await import('../src/lib/socket/handlers');

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      path: '/api/socket',
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    }
  );

  setupSocketHandlers(io);

  // Initialize Telegram bot
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { startPolling, setWebhook } = await import('./bot');

      if (dev) {
        // Development: use long polling (don't await - it blocks)
        startPolling();
      } else {
        // Production: set webhook (handled by API route)
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`;
        await setWebhook(webhookUrl);
      }
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
    }
  } else {
    console.log('> Telegram bot disabled (no TELEGRAM_BOT_TOKEN)');
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running on path /api/socket`);
  });
});
