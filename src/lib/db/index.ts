import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For queries - with connection pool settings
const queryClient = postgres(connectionString, {
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
});
export const db = drizzle(queryClient, { schema });

// For migrations (uses different connection)
export const migrationClient = postgres(connectionString, { max: 1 });
