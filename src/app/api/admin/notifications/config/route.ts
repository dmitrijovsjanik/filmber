import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationConfig } from '@/lib/db/schema';
import { withAdmin } from '@/lib/auth/admin';
import { success, badRequest } from '@/lib/auth/middleware';
import { eq } from 'drizzle-orm';
import type { User } from '@/lib/db/schema';

// Default configuration values
const DEFAULT_CONFIG = {
  'upcoming.enabled': 'true',
  'upcoming.announcementsEnabled': 'true',
  'upcoming.theatricalReleasesEnabled': 'true',
  'upcoming.digitalReleasesEnabled': 'true',
  'upcoming.digitalReleaseDelayDays': '7',
  'upcoming.minPopularity': '50',
};

// GET /api/admin/notifications/config - Get all notification config
export const GET = withAdmin(async (_request: NextRequest, _user: User) => {
  const configs = await db.select().from(notificationConfig);

  // Merge with defaults
  const configMap = new Map(configs.map((c) => [c.key, c.value]));
  const result: Record<string, string> = {};

  for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
    result[key] = configMap.get(key) ?? defaultValue;
  }

  // Add any custom configs that might exist
  for (const config of configs) {
    if (!(config.key in DEFAULT_CONFIG)) {
      result[config.key] = config.value;
    }
  }

  return success({ data: result });
});

// PATCH /api/admin/notifications/config - Update config values
// Accepts either { key, value } for single update or full config object
export const PATCH = withAdmin(async (request: NextRequest, user: User) => {
  try {
    const body = await request.json();

    // Check if it's a full config object (has config keys) or single key/value
    const isBulkUpdate = !('key' in body) && !('value' in body);

    const updates: Array<{ key: string; value: string }> = [];

    if (isBulkUpdate) {
      // Bulk update - body is the full config object
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string' && key.startsWith('upcoming.')) {
          updates.push({ key, value });
        }
      }
    } else {
      // Single update
      const { key, value } = body;
      if (!key || typeof key !== 'string') {
        return badRequest('Missing or invalid key');
      }
      if (value === undefined || value === null) {
        return badRequest('Missing value');
      }
      updates.push({ key, value: String(value) });
    }

    // Validate and save each update
    for (const { key, value } of updates) {
      // Validate specific keys
      if (key === 'upcoming.digitalReleaseDelayDays') {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 90) {
          return badRequest('digitalReleaseDelayDays must be between 0 and 90');
        }
      }

      if (key === 'upcoming.minPopularity') {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 1000) {
          return badRequest('minPopularity must be between 0 and 1000');
        }
      }

      // Check if config exists
      const [existing] = await db
        .select()
        .from(notificationConfig)
        .where(eq(notificationConfig.key, key));

      if (existing) {
        await db
          .update(notificationConfig)
          .set({
            value,
            updatedAt: new Date(),
            updatedBy: user.id,
          })
          .where(eq(notificationConfig.key, key));
      } else {
        await db.insert(notificationConfig).values({
          key,
          value,
          updatedBy: user.id,
        });
      }
    }

    return success({ updated: updates.length });
  } catch (error) {
    console.error('Error updating notification config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
