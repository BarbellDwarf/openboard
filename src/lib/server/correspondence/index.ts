import { Cron } from 'croner';

import { eq, isNull, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { correspondenceReminders, games, users } from '$lib/server/db/schema';
import { completeGame } from '$lib/server/chess/game-service';
import { notifyUser } from '$lib/server/notifications';
import { isMailConfigured, sendMail } from '$lib/server/mail';

/**
 * Correspondence sweeps. Deadlines are derived lazily everywhere else; the
 * sweeper does two passes per tick: it finalizes flagged games once, and it
 * warns the player on the move while their clock still has some slack.
 */

let job: Cron | null = null;

/** Warn once the mover's remaining time drops below this share of the budget. */
export const REMINDER_FRACTION_OF_BUDGET = 0.25;

const DAY_MS = 24 * 60 * 60 * 1000;

interface SweepRow {
	id: string;
	daysPerMove: number | null;
	lastMoveAt: Date | null;
	currentXfen: string | null;
	whiteId: string | null;
	blackId: string | null;
}

async function runningCorrespondenceGames(): Promise<SweepRow[]> {
	return db
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
}

export async function sweepOnce(): Promise<number> {
	const rows = await runningCorrespondenceGames();
	let finalized = 0;
	for (const row of rows) {
		if (row.daysPerMove == null || !row.lastMoveAt) continue;
		const deadlineMs = row.daysPerMove * DAY_MS;
		const elapsed = Date.now() - new Date(row.lastMoveAt).getTime();
		if (elapsed <= deadlineMs) continue;
		const turn = row.currentXfen?.split(' ')[1];
		const result = turn === 'b' ? 'white' : 'black';
		let claimed: boolean;
		try {
			// Guarded finalize: ratings apply, and a move made while we were
			// looking at the row cancels this timeout.
			claimed = await completeGame(row.id, result, 'timeout', {
				onlyIfLastMoveAt: new Date(row.lastMoveAt)
			});
		} catch (error) {
			console.error('[correspondence] sweep finalize failed:', error);
			continue;
		}
		// Lost the claim: the game finished through another path, which owns the
		// notifications. Only a won claim counts as finalized.
		if (!claimed) continue;
		finalized++;
		const body = `Correspondence game decided by flag: ${result} wins.`;
		if (row.whiteId)
			void notifyUser(row.whiteId, 'game-result', {
				body,
				url: `/game/${row.id}`
			});
		if (row.blackId)
			void notifyUser(row.blackId, 'game-result', {
				body,
				url: `/game/${row.id}`
			});
	}
	return finalized;
}

/**
 * Reminds the player on the move that their correspondence clock is running
 * low. One reminder per game per player ever: the reminder table's unique
 * pair index settles races between sweeps, and only an insert that won
 * produces a notification.
 */
export async function remindDuePlayers(): Promise<number> {
	const rows = await runningCorrespondenceGames();
	let sent = 0;
	for (const row of rows) {
		if (row.daysPerMove == null || !row.lastMoveAt) continue;
		const budgetMs = row.daysPerMove * DAY_MS;
		const elapsedMs = Date.now() - new Date(row.lastMoveAt).getTime();
		const remainingMs = budgetMs - elapsedMs;
		// Flagged games belong to the finalize pass above.
		if (remainingMs <= 0) continue;
		if (remainingMs > budgetMs * REMINDER_FRACTION_OF_BUDGET) continue;

		const turn = row.currentXfen?.split(' ')[1];
		const moverId = turn === 'b' ? row.blackId : row.whiteId;
		if (!moverId) continue;

		const prior = await db
			.select({ userId: correspondenceReminders.userId })
			.from(correspondenceReminders)
			.where(eq(correspondenceReminders.gameId, row.id));
		if (prior.some((entry) => entry.userId === moverId)) continue;

		const inserted = await db
			.insert(correspondenceReminders)
			.values({ gameId: row.id, userId: moverId })
			.onConflictDoNothing()
			.returning({ id: correspondenceReminders.id });
		if (inserted.length === 0) continue;

		sent++;
		void notifyUser(moverId, 'reminder', {
			body: 'Your correspondence clock is almost up. It is your move.',
			url: `/game/${row.id}`
		});
		await emailReminder(moverId, row.id);
	}
	return sent;
}

async function emailReminder(userId: string, gameId: string): Promise<void> {
	if (!isMailConfigured()) return;
	const found = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	const email = found[0]?.email;
	if (!email) return;
	const origin = process.env.ORIGIN ?? '';
	await sendMail({
		to: email,
		subject: 'Your move is due soon',
		text: [
			'Hello,',
			'',
			'Your remaining time in a correspondence game is almost up. It is your move:',
			'',
			`${origin}/game/${gameId}`,
			'',
			'If you overstep the deadline, the game is decided by flag.'
		].join('\n')
	});
}

async function runSweep(): Promise<void> {
	try {
		await sweepOnce();
	} catch (error) {
		console.error('[correspondence] finalize sweep failed:', error);
	}
	try {
		await remindDuePlayers();
	} catch (error) {
		console.error('[correspondence] reminder sweep failed:', error);
	}
}

export function startSweeper(): void {
	if (job) return;
	job = new Cron('*/1 * * * *', () => void runSweep());
}

export function stopSweeper(): void {
	job?.stop();
	job = null;
}
