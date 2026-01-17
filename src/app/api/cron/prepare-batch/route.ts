import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  upcomingMovies,
  trackedSeries,
  trackedEpisodes,
  scheduledNotifications,
  notificationConfig,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, isNull, and, lte, or, inArray, gt } from 'drizzle-orm';

const CRON_SECRET = process.env.CRON_SECRET;

// Moscow timezone offset (UTC+3)
const MSK_OFFSET_HOURS = 3;

// Default configuration values
const DEFAULT_ANNOUNCE_MIN_POPULARITY = 20;
const DEFAULT_ANNOUNCE_MIN_AGE_HOURS = 12;
const DEFAULT_DIGITAL_DELAY_DAYS = 7;

// Period definitions (MSK hours)
const PERIODS = {
  day: {
    startMsk: 6, // 06:00 MSK = 03:00 UTC
    endMsk: 18, // 18:00 MSK = 15:00 UTC
    hoursCount: 12,
  },
  evening: {
    startMsk: 18, // 18:00 MSK = 15:00 UTC
    endMsk: 6, // 06:00 MSK next day = 03:00 UTC
    hoursCount: 12,
  },
};


/**
 * Convert MSK hour to UTC hour
 */
function mskToUtc(mskHour: number): number {
  return (mskHour - MSK_OFFSET_HOURS + 24) % 24;
}

/**
 * Get current date in YYYY-MM-DD format (MSK timezone)
 */
function getTodayMsk(): string {
  const now = new Date();
  const mskTime = new Date(now.getTime() + MSK_OFFSET_HOURS * 60 * 60 * 1000);
  return mskTime.toISOString().split('T')[0];
}

/**
 * Calculate scheduled slots for N items within a 12-hour period
 * Distributes items evenly, using :30 slots if more than 12 items
 */
function calculateScheduleSlots(
  itemCount: number,
  period: 'day' | 'evening'
): Array<{ hour: number; minute: number }> {
  const periodConfig = PERIODS[period];
  const slots: Array<{ hour: number; minute: number }> = [];

  if (itemCount === 0) return slots;

  // Maximum slots: 12 hours * 2 slots per hour = 24 slots
  const maxSlots = periodConfig.hoursCount * 2;
  const actualSlots = Math.min(itemCount, maxSlots);

  // Calculate interval between items
  const totalMinutes = periodConfig.hoursCount * 60;
  const intervalMinutes = Math.floor(totalMinutes / actualSlots);

  for (let i = 0; i < actualSlots; i++) {
    const offsetMinutes = i * intervalMinutes;
    let mskHour = periodConfig.startMsk + Math.floor(offsetMinutes / 60);
    const minute = offsetMinutes % 60 >= 30 ? 30 : 0;

    // Handle day wrap for evening period
    if (mskHour >= 24) {
      mskHour -= 24;
    }

    slots.push({
      hour: mskToUtc(mskHour),
      minute,
    });
  }

  return slots;
}

export async function GET(request: NextRequest) {
  return handlePrepareBatch(request);
}

export async function POST(request: NextRequest) {
  return handlePrepareBatch(request);
}

async function handlePrepareBatch(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') || 'day') as 'day' | 'evening';

  if (!['day', 'evening'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
  }

  try {
    const results = {
      period,
      announcements: { found: 0, scheduled: 0 },
      theatricalReleases: { found: 0, scheduled: 0 },
      digitalReleases: { found: 0, scheduled: 0 },
      seasonAnnouncements: { found: 0, scheduled: 0 },
      episodeReleases: { found: 0, scheduled: 0 },
      errors: [] as string[],
    };

    const config = await getConfig();
    const today = getTodayMsk();

    // Clear any existing pending notifications for this period and date
    await db
      .delete(scheduledNotifications)
      .where(
        and(
          eq(scheduledNotifications.scheduledDate, today),
          eq(scheduledNotifications.period, period),
          eq(scheduledNotifications.status, 'pending')
        )
      );

    // Collect all items to schedule
    const itemsToSchedule: Array<{
      type: string;
      tmdbId: number;
      upcomingMovieId?: string;
      trackedSeriesId?: string;
      trackedEpisodeId?: string;
      priority: number;
    }> = [];

    // 1. Get theatrical releases for today
    const theatricalReleases = await getTheatricalReleases(today);
    results.theatricalReleases.found = theatricalReleases.length;
    for (const movie of theatricalReleases) {
      itemsToSchedule.push({
        type: NOTIFICATION_TYPE.THEATRICAL_RELEASE,
        tmdbId: movie.tmdbId,
        upcomingMovieId: movie.id,
        priority: 10, // High priority
      });
    }

    // 2. Get digital releases (with delay)
    const digitalReleases = await getDigitalReleases(today, config.digitalDelayDays);
    results.digitalReleases.found = digitalReleases.length;
    for (const movie of digitalReleases) {
      // Skip if already sent theatrical release today (prevent duplicates)
      const alreadyScheduled = itemsToSchedule.some(
        (item) => item.tmdbId === movie.tmdbId && item.type === NOTIFICATION_TYPE.THEATRICAL_RELEASE
      );
      if (!alreadyScheduled) {
        itemsToSchedule.push({
          type: NOTIFICATION_TYPE.DIGITAL_RELEASE,
          tmdbId: movie.tmdbId,
          upcomingMovieId: movie.id,
          priority: 20,
        });
      }
    }

    // 3. Get announcements (new movies discovered, with maturity check)
    const announcements = await getAnnouncements(config);
    results.announcements.found = announcements.length;
    for (const movie of announcements) {
      // Skip if already scheduled for release
      const alreadyScheduled = itemsToSchedule.some((item) => item.tmdbId === movie.tmdbId);
      if (!alreadyScheduled) {
        itemsToSchedule.push({
          type: NOTIFICATION_TYPE.ANNOUNCEMENT,
          tmdbId: movie.tmdbId,
          upcomingMovieId: movie.id,
          priority: 30,
        });
      }
    }

    // 4. Get season announcements
    const seasonAnnouncements = await getSeasonAnnouncements();
    results.seasonAnnouncements.found = seasonAnnouncements.length;
    for (const series of seasonAnnouncements) {
      itemsToSchedule.push({
        type: NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT,
        tmdbId: series.tmdbId,
        trackedSeriesId: series.id,
        priority: 15,
      });
    }

    // 5. Get episode releases
    const episodeReleases = await getEpisodeReleases(today, config.episodeDelayDays);
    results.episodeReleases.found = episodeReleases.length;
    for (const episode of episodeReleases) {
      itemsToSchedule.push({
        type: NOTIFICATION_TYPE.EPISODE_RELEASE,
        tmdbId: episode.series.tmdbId,
        trackedSeriesId: episode.trackedSeriesId,
        trackedEpisodeId: episode.id,
        priority: 25,
      });
    }

    // Sort by priority
    itemsToSchedule.sort((a, b) => a.priority - b.priority);

    // Calculate schedule slots
    const slots = calculateScheduleSlots(itemsToSchedule.length, period);

    // Create scheduled notifications
    for (let i = 0; i < itemsToSchedule.length; i++) {
      const item = itemsToSchedule[i];
      const slot = slots[i] || slots[slots.length - 1]; // Use last slot if overflow

      try {
        await db.insert(scheduledNotifications).values({
          type: item.type,
          tmdbId: item.tmdbId,
          upcomingMovieId: item.upcomingMovieId || null,
          trackedSeriesId: item.trackedSeriesId || null,
          trackedEpisodeId: item.trackedEpisodeId || null,
          period,
          scheduledDate: today,
          scheduledHour: slot.hour,
          scheduledMinute: slot.minute,
          priority: item.priority,
          status: 'pending',
        });

        // Update result counts
        switch (item.type) {
          case NOTIFICATION_TYPE.ANNOUNCEMENT:
            results.announcements.scheduled++;
            break;
          case NOTIFICATION_TYPE.THEATRICAL_RELEASE:
            results.theatricalReleases.scheduled++;
            break;
          case NOTIFICATION_TYPE.DIGITAL_RELEASE:
            results.digitalReleases.scheduled++;
            break;
          case NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT:
            results.seasonAnnouncements.scheduled++;
            break;
          case NOTIFICATION_TYPE.EPISODE_RELEASE:
            results.episodeReleases.scheduled++;
            break;
        }
      } catch (error) {
        // Likely duplicate - skip
        results.errors.push(`Failed to schedule ${item.type} for tmdbId ${item.tmdbId}: ${String(error)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Prepared ${itemsToSchedule.length} notifications for ${period} period`,
      results,
      config: {
        period,
        date: today,
        totalItems: itemsToSchedule.length,
        totalSlots: slots.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Prepare batch error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare batch', details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================
// Data fetching functions
// ============================================

async function getConfig() {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, [
        'upcoming.announceMinPopularity',
        'upcoming.minAgeHours',
        'upcoming.digitalReleaseDelayDays',
        'upcoming.episodeDelayDays',
        'upcoming.publicEnabled',
      ])
    );

  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  return {
    announceMinPopularity: parseInt(configMap.get('upcoming.announceMinPopularity') || String(DEFAULT_ANNOUNCE_MIN_POPULARITY), 10),
    minAgeHours: parseInt(configMap.get('upcoming.minAgeHours') || String(DEFAULT_ANNOUNCE_MIN_AGE_HOURS), 10),
    digitalDelayDays: parseInt(configMap.get('upcoming.digitalReleaseDelayDays') || String(DEFAULT_DIGITAL_DELAY_DAYS), 10),
    episodeDelayDays: parseInt(configMap.get('upcoming.episodeDelayDays') || '7', 10),
    publicEnabled: configMap.get('upcoming.publicEnabled') === 'true',
  };
}

async function getTheatricalReleases(today: string) {
  return db
    .select()
    .from(upcomingMovies)
    .where(
      and(
        eq(upcomingMovies.status, 'tracked'),
        isNull(upcomingMovies.theatricalReleaseSentAt),
        or(
          eq(upcomingMovies.theatricalReleaseUs, today),
          eq(upcomingMovies.theatricalReleaseRu, today)
        )
      )
    )
    .limit(50);
}

async function getDigitalReleases(today: string, delayDays: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - delayDays);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  return db
    .select()
    .from(upcomingMovies)
    .where(
      and(
        or(eq(upcomingMovies.status, 'tracked'), eq(upcomingMovies.status, 'released')),
        isNull(upcomingMovies.digitalReleaseSentAt),
        lte(upcomingMovies.digitalRelease, targetDateStr)
      )
    )
    .limit(50);
}

async function getAnnouncements(config: Awaited<ReturnType<typeof getConfig>>) {
  const maturityCutoff = new Date(Date.now() - config.minAgeHours * 60 * 60 * 1000);
  const today = getTodayMsk();

  // Get candidates
  const candidates = await db
    .select()
    .from(upcomingMovies)
    .where(
      and(
        eq(upcomingMovies.status, 'tracked'),
        isNull(upcomingMovies.announcementSentAt),
        lte(upcomingMovies.discoveredAt, maturityCutoff)
      )
    )
    .limit(100);

  // Filter by quality criteria and future release date
  return candidates.filter((movie) => {
    const popularity = parseFloat(movie.popularity || '0');
    const hasRussian = movie.overviewRu && movie.overviewRu.length > 0;
    const hasPoster = movie.posterPath && movie.posterPath.length > 0;

    // Check that release date is in the future
    const releaseDate = movie.theatricalReleaseRu || movie.theatricalReleaseUs || null;
    const isFutureRelease = releaseDate && releaseDate > today;

    return (
      popularity >= config.announceMinPopularity &&
      hasRussian &&
      hasPoster &&
      isFutureRelease
    );
  });
}

async function getSeasonAnnouncements() {
  return db
    .select()
    .from(trackedSeries)
    .where(
      and(
        eq(trackedSeries.trackingStatus, 'active'),
        isNull(trackedSeries.seasonAnnouncementSentAt),
        gt(trackedSeries.currentSeasons, trackedSeries.lastKnownSeasons)
      )
    )
    .limit(50);
}

async function getEpisodeReleases(today: string, delayDays: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - delayDays);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  return db
    .select({
      id: trackedEpisodes.id,
      trackedSeriesId: trackedEpisodes.trackedSeriesId,
      seasonNumber: trackedEpisodes.seasonNumber,
      episodeNumber: trackedEpisodes.episodeNumber,
      episodeName: trackedEpisodes.episodeName,
      series: {
        tmdbId: trackedSeries.tmdbId,
        title: trackedSeries.title,
        titleRu: trackedSeries.titleRu,
      },
    })
    .from(trackedEpisodes)
    .innerJoin(trackedSeries, eq(trackedEpisodes.trackedSeriesId, trackedSeries.id))
    .where(
      and(
        isNull(trackedEpisodes.notificationSentAt),
        lte(trackedEpisodes.notifyDate, targetDateStr)
      )
    )
    .limit(50);
}
