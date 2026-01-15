/**
 * Seed script to add series notification config values
 * Usage: npx tsx scripts/seed-series-config.ts [--admin-id=<telegramId>]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../src/lib/db';
import { notificationConfig } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const CONFIG_VALUES = [
  {
    key: 'series.syncEnabled',
    value: 'true',
    description: 'Enable daily series sync cron job',
  },
  {
    key: 'series.publicEnabled',
    value: 'false',
    description: 'Enable series notifications for all users (false = admin-only for testing)',
  },
  {
    key: 'series.adminTelegramIds',
    value: '',
    description: 'Comma-separated admin Telegram IDs for testing notifications',
  },
  {
    key: 'series.episodeDelayDays',
    value: '7',
    description: 'Days to wait after air_date before notifying (for dubbing)',
  },
  {
    key: 'series.maxEpisodesPerHour',
    value: '3',
    description: 'Maximum episode notifications to send per hour',
  },
];

async function main() {
  console.log('🎬 Seeding series notification config...\n');

  // Parse admin ID from command line
  const adminIdArg = process.argv.find((arg) => arg.startsWith('--admin-id='));
  const adminId = adminIdArg?.split('=')[1];

  if (adminId) {
    const adminConfig = CONFIG_VALUES.find((c) => c.key === 'series.adminTelegramIds');
    if (adminConfig) {
      adminConfig.value = adminId;
    }
  }

  let inserted = 0;
  let skipped = 0;

  for (const config of CONFIG_VALUES) {
    // Check if already exists
    const existing = await db
      .select()
      .from(notificationConfig)
      .where(eq(notificationConfig.key, config.key))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  ${config.key} already exists (value: ${existing[0].value})`);
      skipped++;
      continue;
    }

    // Insert new config
    await db.insert(notificationConfig).values({
      key: config.key,
      value: config.value,
      description: config.description,
    });

    console.log(`✅ ${config.key} = "${config.value}"`);
    inserted++;
  }

  console.log(`\n📊 Summary: ${inserted} inserted, ${skipped} skipped`);

  if (!adminId) {
    console.log('\n💡 Tip: Run with --admin-id=<telegramId> to set admin for testing');
    console.log('   Example: npx tsx scripts/seed-series-config.ts --admin-id=123456789');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
