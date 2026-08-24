import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { pool } from '$lib/server/db';

/**
 * Liveness for orchestrators: answers 200 only while the application can
 * reach PostgreSQL. Unauthenticated by design; it exposes no data beyond
 * process uptime.
 */
export const GET: RequestHandler = async () => {
	let dbUp = false;
	try {
		await pool.query('SELECT 1');
		dbUp = true;
	} catch {
		dbUp = false;
	}

	return json(
		{ ok: dbUp, db: dbUp ? 'up' : 'down', uptimeSeconds: Math.floor(process.uptime()) },
		{ status: dbUp ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
