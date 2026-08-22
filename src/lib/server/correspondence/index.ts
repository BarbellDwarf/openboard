import { Cron } from 'croner';

import { eq, isNull, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { games } from '$lib/server/db/schema';

/**
 * Correspondence flag sweeps. Deadlines are derived lazily everywhere else;
 * this sweeper finalizes flagged games once and emits nothing extra.
 */

let job: Cron | null = null;

export async function sweepOnce(): Promise<number> {
	const rows = await db
		.select({ id: games.id, whiteId: games.whiteId, blackId: games.blackId })
		.from(games)
		.where(and(eq(games.status, 'started'), isNull(games.result)));
	let finalized = 0;
	for (const row of rows) {
		const [game] = await db.select().from(games).where(eq(games.id, row.id)).limit(1);
		if (!game || game.daysPerMove == null || !game.lastMoveAt) continue;
		const deadlineMs = game.daysPerMove * 24 * 60 * 60 * 1000;
		const elapsed = Date.now() - new Date(game.lastMoveAt).getTime();
		const turn = game.currentXfen?.split(' ')[1];
		if (elapsed <= deadlineMs) continue;
		const loser = turn === 'w' ? 'white' : 'black';
		const result = loser === 'white' ? 'black' : 'white';
		const termination = 'timeout';
		await db
			.update(games)
			.set({ status: 'finished', result, termination, finishedAt: new Date() })
			.where(eq(games.id, row.id));
		finalized++;
	}
	return finalized;
}

export function startSweeper(): void {
	if (job) return;
	job = new Cron('*/1 * * * *', () => void sweepOnce());
}

export function stopSweeper(): void {
	job?.stop();
	job = null;
}
