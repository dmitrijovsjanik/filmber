import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

// Lazy initialization to avoid errors during Next.js build
let _db: PostgresJsDatabase<typeof schema> | null = null;
let _queryClient: Sql | null = null;
let _migrationClient: Sql | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Make sure environment variables are loaded.'
    );
  }
  return connectionString;
}

// For queries - with connection pool settings
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    if (!_db) {
      _queryClient = postgres(getConnectionString(), {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      _db = drizzle(_queryClient, { schema });
    }
    return (_db as Record<string | symbol, unknown>)[prop];
  },
});

// For migrations (uses different connection)
export function getMigrationClient(): Sql {
  if (!_migrationClient) {
    _migrationClient = postgres(getConnectionString(), { max: 1 });
  }
  return _migrationClient;
}
