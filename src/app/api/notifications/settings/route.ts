import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationSettings } from '@/lib/db/schema';
import { getAuthUser, unauthorized, success } from '@/lib/auth/middleware';
import { eq } from 'drizzle-orm';

// GET /api/notifications/settings - Get user's notification settings
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const [settings] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, user.id));

  // Return default settings if none exist
  if (!settings) {
    return success({
      watchReminders: true, // Default enabled
    });
  }

  return success({
    watchReminders: settings.watchReminders,
  });
}

// PATCH /api/notifications/settings - Update notification settings
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { watchReminders } = body;

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, user.id));

    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(notificationSettings)
        .set({
          watchReminders: watchReminders ?? existing.watchReminders,
          updatedAt: new Date(),
        })
        .where(eq(notificationSettings.userId, user.id))
        .returning();

      return success({
        watchReminders: updated.watchReminders,
      });
    } else {
      // Create new settings
      const [created] = await db
        .insert(notificationSettings)
        .values({
          userId: user.id,
          watchReminders: watchReminders ?? true,
        })
        .returning();

      return success({
        watchReminders: created.watchReminders,
      });
    }
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
