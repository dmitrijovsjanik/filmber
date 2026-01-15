import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationSettings, RELEASE_REGION, type ReleaseRegion } from '@/lib/db/schema';
import { getAuthUser, unauthorized, success } from '@/lib/auth/middleware';
import { eq } from 'drizzle-orm';

// Default values for notification settings
const DEFAULT_SETTINGS = {
  watchReminders: true,
  upcomingAnnouncements: true,
  upcomingTheatricalReleases: true,
  upcomingDigitalReleases: true,
  seriesSeasonAnnouncements: true,
  seriesEpisodeReleases: true,
  appUpdates: true,
  preferredReleaseRegion: RELEASE_REGION.US as ReleaseRegion,
};

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
    return success(DEFAULT_SETTINGS);
  }

  return success({
    watchReminders: settings.watchReminders ?? DEFAULT_SETTINGS.watchReminders,
    upcomingAnnouncements: settings.upcomingAnnouncements ?? DEFAULT_SETTINGS.upcomingAnnouncements,
    upcomingTheatricalReleases: settings.upcomingTheatricalReleases ?? DEFAULT_SETTINGS.upcomingTheatricalReleases,
    upcomingDigitalReleases: settings.upcomingDigitalReleases ?? DEFAULT_SETTINGS.upcomingDigitalReleases,
    seriesSeasonAnnouncements: settings.seriesSeasonAnnouncements ?? DEFAULT_SETTINGS.seriesSeasonAnnouncements,
    seriesEpisodeReleases: settings.seriesEpisodeReleases ?? DEFAULT_SETTINGS.seriesEpisodeReleases,
    appUpdates: settings.appUpdates ?? DEFAULT_SETTINGS.appUpdates,
    preferredReleaseRegion: settings.preferredReleaseRegion ?? DEFAULT_SETTINGS.preferredReleaseRegion,
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
    const {
      watchReminders,
      upcomingAnnouncements,
      upcomingTheatricalReleases,
      upcomingDigitalReleases,
      seriesSeasonAnnouncements,
      seriesEpisodeReleases,
      appUpdates,
      preferredReleaseRegion,
    } = body;

    // Validate preferredReleaseRegion if provided
    if (preferredReleaseRegion && !['US', 'RU'].includes(preferredReleaseRegion)) {
      return NextResponse.json(
        { error: 'Invalid preferredReleaseRegion. Must be "US" or "RU".' },
        { status: 400 }
      );
    }

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
          upcomingAnnouncements: upcomingAnnouncements ?? existing.upcomingAnnouncements,
          upcomingTheatricalReleases: upcomingTheatricalReleases ?? existing.upcomingTheatricalReleases,
          upcomingDigitalReleases: upcomingDigitalReleases ?? existing.upcomingDigitalReleases,
          seriesSeasonAnnouncements: seriesSeasonAnnouncements ?? existing.seriesSeasonAnnouncements,
          seriesEpisodeReleases: seriesEpisodeReleases ?? existing.seriesEpisodeReleases,
          appUpdates: appUpdates ?? existing.appUpdates,
          preferredReleaseRegion: preferredReleaseRegion ?? existing.preferredReleaseRegion,
          updatedAt: new Date(),
        })
        .where(eq(notificationSettings.userId, user.id))
        .returning();

      return success({
        watchReminders: updated.watchReminders,
        upcomingAnnouncements: updated.upcomingAnnouncements,
        upcomingTheatricalReleases: updated.upcomingTheatricalReleases,
        upcomingDigitalReleases: updated.upcomingDigitalReleases,
        seriesSeasonAnnouncements: updated.seriesSeasonAnnouncements,
        seriesEpisodeReleases: updated.seriesEpisodeReleases,
        appUpdates: updated.appUpdates,
        preferredReleaseRegion: updated.preferredReleaseRegion,
      });
    } else {
      // Create new settings
      const [created] = await db
        .insert(notificationSettings)
        .values({
          userId: user.id,
          watchReminders: watchReminders ?? DEFAULT_SETTINGS.watchReminders,
          upcomingAnnouncements: upcomingAnnouncements ?? DEFAULT_SETTINGS.upcomingAnnouncements,
          upcomingTheatricalReleases: upcomingTheatricalReleases ?? DEFAULT_SETTINGS.upcomingTheatricalReleases,
          upcomingDigitalReleases: upcomingDigitalReleases ?? DEFAULT_SETTINGS.upcomingDigitalReleases,
          seriesSeasonAnnouncements: seriesSeasonAnnouncements ?? DEFAULT_SETTINGS.seriesSeasonAnnouncements,
          seriesEpisodeReleases: seriesEpisodeReleases ?? DEFAULT_SETTINGS.seriesEpisodeReleases,
          appUpdates: appUpdates ?? DEFAULT_SETTINGS.appUpdates,
          preferredReleaseRegion: preferredReleaseRegion ?? DEFAULT_SETTINGS.preferredReleaseRegion,
        })
        .returning();

      return success({
        watchReminders: created.watchReminders,
        upcomingAnnouncements: created.upcomingAnnouncements,
        upcomingTheatricalReleases: created.upcomingTheatricalReleases,
        upcomingDigitalReleases: created.upcomingDigitalReleases,
        seriesSeasonAnnouncements: created.seriesSeasonAnnouncements,
        seriesEpisodeReleases: created.seriesEpisodeReleases,
        appUpdates: created.appUpdates,
        preferredReleaseRegion: created.preferredReleaseRegion,
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
