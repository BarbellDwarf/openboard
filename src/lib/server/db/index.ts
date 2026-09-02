import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export const pool = new Pool({
	connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/** Close the pool. Called by the production server on SIGTERM. */
export async function closePool(): Promise<void> {
	await pool.end();
}
