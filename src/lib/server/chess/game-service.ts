import { asc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { games, moves as movesTable, users } from '$lib/server/db/schema';

import { applyMove, drawByFiftyMoves, drawByRepetition, startPosition } from './engine';
import { buildPgn } from './pgn';
import type {
	Color,
	EngineState,
	GameStatus,
	ResultValue,
	Termination,
	TimeControl,
	VariantId
} from './types';

/**
 * Game lifecycle and persistence. Pure rules live in engine and clocks; this
 * module owns transactions against the schema contract.
 */

export interface CreateGameInput {
	variant: VariantId;
	rated: boolean;
	timeControl: TimeControl;
	whiteId: string | null;
	blackId: string | null;
}

export async function createGame(input: CreateGameInput): Promise<string> {
	const state = startPosition(input.variant);
	const [row] = await db
		.insert(games)
		.values({
			variant: input.variant,
			rated: input.rated,
			initialMs: input.timeControl.initialMs,
			incrementMs: input.timeControl.incrementMs,
			daysPerMove: input.timeControl.daysPerMove,
			status: 'started',
			currentXfen: state.xfen,
			whiteId: input.whiteId,
			blackId: input.blackId,
			startedAt: new Date(),
			lastMoveAt: new Date()
		})
		.returning({ id: games.id });
	return row.id;
}

export interface LoadedGame {
	id: string;
	variant: VariantId;
	rated: boolean;
	status: GameStatus;
	result: ResultValue | null;
	termination: Termination | null;
	timeControl: TimeControl;
	whiteId: string | null;
	blackId: string | null;
	state: EngineState;
	sanMoves: string[];
	lastMoveAtMs: number;
}

export async function loadGame(gameId: string): Promise<LoadedGame | null> {
	const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
	if (!game) return null;

	const rows = await db
		.select()
		.from(movesTable)
		.where(eq(movesTable.gameId, gameId))
		.orderBy(asc(movesTable.ply));

	let state: EngineState = startPosition(game.variant as VariantId);
	for (const row of rows) {
		const applied = applyMove(state.variant, state.xfen, row.uci);
		if (applied.ok) state = applied.state;
	}

	return {
		id: game.id,
		variant: game.variant as VariantId,
		rated: game.rated,
		status: game.status as GameStatus,
		result: game.result as ResultValue | null,
		termination: game.termination as Termination | null,
		timeControl: {
			initialMs: game.initialMs,
			incrementMs: game.incrementMs,
			daysPerMove: game.daysPerMove
		},
		whiteId: game.whiteId,
		blackId: game.blackId,
		state,
		sanMoves: rows.map((r) => r.san),
		lastMoveAtMs: (game.lastMoveAt ?? game.startedAt ?? game.createdAt).getTime()
	};
}

export interface MovePersistenceResult {
	applied: boolean;
	reason?:
		| 'game-not-found'
		| 'game-not-started'
		| 'illegal-move'
		| 'invalid-move-format'
		| 'invalid-position'
		| 'already-moved';
	finished?: { result: ResultValue; termination: Termination } | null;
	state?: EngineState;
	san?: string;
}

/** Apply and persist a move in one transaction, including draw detection. */
export async function persistMove(gameId: string, uci: string): Promise<MovePersistenceResult> {
	const loaded = await loadGame(gameId);
	if (!loaded) return { applied: false, reason: 'game-not-found' };
	if (loaded.status !== 'started') return { applied: false, reason: 'game-not-started' };

	// Stored xfens are positions after each ply; the pre-move position is
	// already the last entry, so do not duplicate it here.
	const history = await moveHistoryXfens(gameId);

	const outcome = applyMove(loaded.variant, loaded.state.xfen, uci);
	if (!outcome.ok) return { applied: false, reason: outcome.error };

	let finished: { result: ResultValue; termination: Termination } | null = outcome.finished;
	if (!finished && drawByRepetition([...history, outcome.state.xfen]))
		finished = { result: 'draw', termination: 'repetition' };
	if (!finished && drawByFiftyMoves(outcome.state.xfen)) {
		finished = { result: 'draw', termination: 'fifty-moves' };
	}

	try {
		await db.transaction(async (tx) => {
			await tx.insert(movesTable).values({
				gameId,
				ply: loaded.sanMoves.length + 1,
				uci,
				san: outcome.san,
				xfenAfter: outcome.state.xfen
			});
			await tx
				.update(games)
				.set({
					currentXfen: outcome.state.xfen,
					moveCount: loaded.sanMoves.length + 1,
					lastMoveAt: new Date(),
					pgn: buildPgn({
						variant: loaded.variant,
						rated: loaded.rated,
						whiteName: 'White',
						blackName: 'Black',
						sanMoves: [...loaded.sanMoves, outcome.san],
						result: finished?.result ?? null,
						timeControlDescription: timeControlDescription(loaded.timeControl)
					})
				})
				.where(eq(games.id, gameId));

			if (finished) {
				await tx
					.update(games)
					.set({
						status: 'finished',
						result: finished.result,
						termination: finished.termination,
						finishedAt: new Date()
					})
					.where(eq(games.id, gameId));
			}
		});
	} catch (error) {
		// Unique violation on (game_id, ply): a concurrent identical move won.
		if (
			typeof error === 'object' &&
			error !== null &&
			(error as { code?: string }).code === '23505'
		) {
			return { applied: false, reason: 'already-moved' };
		}
		throw error;
	}

	return { applied: true, finished, state: outcome.state, san: outcome.san };
}

import { applyRatedResult } from '$lib/server/ratings/service';
import { speedClassFor } from './types';

/** Finish a game and, when rated, apply Glicko-2 updates. */
export async function completeGame(
	gameId: string,
	result: ResultValue,
	termination: Termination
): Promise<void> {
	const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
	if (!game || game.status !== 'started') return;
	await finishGame(gameId, result, termination);
	if (!game.rated) return;
	await applyRatedResult({
		gameId,
		variant: game.variant as VariantId,
		speed: speedClassFor({
			initialMs: game.initialMs,
			incrementMs: game.incrementMs,
			daysPerMove: game.daysPerMove
		}),
		result,
		whiteId: game.whiteId,
		blackId: game.blackId
	});
}

export async function finishGame(
	gameId: string,
	result: ResultValue,
	termination: Termination
): Promise<void> {
	await db
		.update(games)
		.set({ status: 'finished', result, termination, finishedAt: new Date() })
		.where(eq(games.id, gameId));
}

export async function abortGame(gameId: string): Promise<void> {
	await db
		.update(games)
		.set({ status: 'aborted', finishedAt: new Date() })
		.where(eq(games.id, gameId));
}

async function moveHistoryXfens(gameId: string): Promise<string[]> {
	const rows = await db
		.select({ xfenAfter: movesTable.xfenAfter })
		.from(movesTable)
		.where(eq(movesTable.gameId, gameId))
		.orderBy(asc(movesTable.ply));
	return rows.map((r) => r.xfenAfter);
}

function timeControlDescription(tc: TimeControl): string {
	if (tc.daysPerMove != null) return `${tc.daysPerMove}/86400`;
	const initialSeconds = Math.round((tc.initialMs ?? 0) / 1000);
	const incrementSeconds = Math.round((tc.incrementMs ?? 0) / 1000);
	return `${initialSeconds}+${incrementSeconds}`;
}

export async function playerColorFor(gameId: string, userId: string): Promise<Color | null> {
	const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
	if (!game) return null;
	if (game.whiteId === userId) return 'white';
	if (game.blackId === userId) return 'black';
	return null;
}

export async function playerName(userId: string | null): Promise<string> {
	if (!userId) return 'Anonymous';
	const [row] = await db
		.select({ name: users.name })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return row?.name ?? 'Anonymous';
}
