import { Cron } from 'croner';

import { eq, isNull, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { games } from '$lib/server/db/schema';
import { completeGame } from '$lib/server/chess/game-service';
import { notifyUser } from '$lib/server/notifications';

/**
 * Correspondence flag sweeps. Deadlines are derived lazily everywhere else;
 * this sweeper finalizes flagged games once and emits nothing extra.
 */

let job: Cron | null = null;

export async function sweepOnce(): Promise<number> {
	const rows = await db
		.select({
			id: games.id,
			daysPerMove: games.daysPerMove,
			lastMoveAt: games.lastMoveAt,
			currentXfen: games.currentXfen,
			whiteId: games.whiteId,
			blackId: games.blackId
		})
		.from(games)
		.where(and(eq(games.status, 'started'), isNull(games.result)));
	let finalized = 0;
	for (const row of rows) {
		if (row.daysPerMove == null || !row.lastMoveAt) continue;
		const deadlineMs = row.daysPerMove * 24 * 60 * 60 * 1000;
		const elapsed = Date.now() - new Date(row.lastMoveAt).getTime();
		if (elapsed <= deadlineMs) continue;
		const turn = row.currentXfen?.split(' ')[1];
		const result = turn === 'b' ? 'white' : 'black';
		try {
			// Guarded finalize: ratings apply, and a move made while we were
			// looking at the row cancels this timeout.
			await completeGame(row.id, result, 'timeout', {
				onlyIfLastMoveAt: new Date(row.lastMoveAt)
			});
			finalized++;
		} catch (error) {
			console.error('[correspondence] sweep finalize failed:', error);
			continue;
		}
		void notifyUser(row.whiteId ?? '', 'game-result', {
			body: `Correspondence game decided by flag: ${result} wins.`,
			url: `/game/${row.id}`
		});
		void notifyUser(row.blackId ?? '', 'game-result', {
			body: `Correspondence game decided by flag: ${result} wins.`,
			url: `/game/${row.id}`
		});
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
