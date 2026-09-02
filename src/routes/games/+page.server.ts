import { redirect } from '@sveltejs/kit';
import { or, eq, desc } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { games } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login?returnTo=/games');

	const rows = await db
		.select()
		.from(games)
		.where(or(eq(games.whiteId, locals.user.id), eq(games.blackId, locals.user.id)))
		.orderBy(desc(games.createdAt))
		.limit(50);

	return {
		games: rows.map((g) => ({
			id: g.id,
			variant: g.variant,
			rated: g.rated,
			status: g.status,
			result: g.result,
			daysPerMove: g.daysPerMove,
			deadline:
				g.status === 'started' && g.daysPerMove != null && g.lastMoveAt
					? new Date(g.lastMoveAt).getTime() + g.daysPerMove * 86400000
					: 0
		}))
	};
};
