# Security Patterns

## Authentication Flow

```typescript
// Telegram WebApp Auth
const authFlow = {
  step1: "Receive initData from Telegram WebApp",
  step2: "Validate HMAC-SHA256 signature",
  step3: "Extract user data from initDataUnsafe",
  step4: "Create/update user in database",
  step5: "Generate JWT token",
  step6: "Store session in user_sessions table",
  step7: "Return token to client"
};
```

---

## Security Measures Overview

```typescript
const securityMeasures = {
  authentication: "Telegram HMAC-SHA256 + JWT httpOnly cookies",
  authorization: "User ID validation on protected routes",
  input_validation: "Zod schemas for API inputs",
  sql_injection: "Drizzle ORM parameterized queries",
  xss_protection: "React auto-escaping + CSP headers",
  rate_limiting: "Future: per-user/IP rate limits",
  https: "Enforced in production via nginx"
};
```

---

## General Security Checklist

- [ ] Validate Telegram initData with HMAC-SHA256
- [ ] Sanitize user input before database queries
- [ ] Use parameterized queries (Drizzle ORM)
- [ ] Validate JWT tokens on protected routes
- [ ] Rate limit API endpoints
- [ ] Escape HTML in user-generated content
- [ ] Use HTTPS in production
- [ ] Secure WebSocket connections

---

## React Security Checklist

- [ ] XSS prevention (avoid `dangerouslySetInnerHTML`)
- [ ] Input validation on all forms
- [ ] Sanitize user-generated content
- [ ] Use `httpOnly` cookies for tokens
- [ ] Validate Telegram initData on every auth request
- [ ] Environment variable protection (no secrets in client code)

---

## Telegram initData Validation

```typescript
// src/lib/auth/telegram.ts
import crypto from 'crypto';

export function validateTelegramInitData(initData: string, botToken: string): boolean {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');

  if (!hash) return false;

  urlParams.delete('hash');

  // Sort parameters alphabetically
  const params = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create secret key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(params)
    .digest('hex');

  return hash === calculatedHash;
}
```

---

## JWT Token Pattern

```typescript
// src/lib/auth/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const TOKEN_EXPIRY = '7d';

export interface JwtPayload {
  userId: number;
  telegramId: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
```

---

## API Route Protection

```typescript
// src/lib/auth/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: JwtPayload) => Promise<NextResponse>
) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = verifyToken(token);

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }

  return handler(request, user);
}
```

---

## Input Validation with Zod

```typescript
// src/lib/validation/schemas.ts
import { z } from 'zod';

export const swipeSchema = z.object({
  movieId: z.number().positive(),
  action: z.enum(['like', 'skip']),
  roomCode: z.string().length(6).optional()
});

export const roomCreateSchema = z.object({
  filters: z.object({
    genres: z.array(z.number()).optional(),
    yearFrom: z.number().min(1900).max(2100).optional(),
    yearTo: z.number().min(1900).max(2100).optional(),
    ratingMin: z.number().min(0).max(10).optional()
  }).optional()
});

// Usage in API route
export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = swipeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { movieId, action, roomCode } = result.data;
  // ... proceed with validated data
}
```

---

## Environment Security

```bash
# Never expose these to client
JWT_SECRET=...
DATABASE_URL=...
TELEGRAM_BOT_TOKEN=...

# Safe for client (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_SOCKET_URL=...
```

---

## Content Security Policy

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: image.tmdb.org",
      "connect-src 'self' api.themoviedb.org wss:",
      "frame-ancestors 'self' telegram.org web.telegram.org"
    ].join('; ')
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];
```

---

## SQL Injection Prevention

```typescript
// Drizzle ORM automatically uses parameterized queries
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Safe - parameterized
const user = await db.query.users.findFirst({
  where: eq(users.telegramId, telegramId)
});

// Also safe - Drizzle handles escaping
const result = await db
  .select()
  .from(users)
  .where(eq(users.id, userId));
```

---

## Rate Limiting (Future)

```typescript
// Example rate limiter implementation
const rateLimit = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}
```
