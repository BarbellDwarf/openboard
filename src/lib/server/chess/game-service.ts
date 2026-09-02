import { and, asc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { games, moves as movesTable, users } from '$lib/server/db/schema';

import {
	applyMove,
	chess960StartFen,
	drawByFiftyMoves,
	drawByThreefold,
	loadPosition,
	startPosition,
	stateFromPosition
} from './engine';
import { fenToEngineState as ccFenToState } from './chinese-checkers';
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
	/** Bot strength for solo games; null (the default) for human games. */
	botLevel?: number | null;
}

export async function createGame(input: CreateGameInput): Promise<string> {
	// Chess960 picks a random legal back rank at creation; other variants use
	// their fixed start position. The array is stored so PGNs and repetition
	// detection both replay from the real start.
	const startFen = input.variant === 'chess960' ? chess960StartFen() : null;
	const state = startFen
		? stateFromPosition(loadPosition('chess960', startFen), 'chess960')
		: startPosition(input.variant);
	// chinese-checkers stores its start FEN in startFen (no chessops).
	const ccStartFen =
		input.variant === 'chinese-checkers' ? startPosition('chinese-checkers').xfen : startFen;
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
			startFen: ccStartFen,
			whiteId: input.whiteId,
			blackId: input.blackId,
			botLevel: input.botLevel ?? null,
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
	/** Bot strength for solo games; null for games between humans. */
	botLevel: number | null;
	/** Shuffled start for Chess960; null otherwise. Replay seeds from here. */
	startFen: string | null;
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

	let state: EngineState;
	if (game.variant === 'chinese-checkers') {
		state = game.startFen ? ccFenToState(game.startFen) : startPosition('chinese-checkers');
	} else {
		state = game.startFen
			? stateFromPosition(loadPosition(game.variant as VariantId, game.startFen), 'chess960')
			: startPosition(game.variant as VariantId);
	}
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
		botLevel: game.botLevel,
		startFen: game.startFen,
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
		| 'promotion-piece-required'
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

	// PGN seats carry real usernames; solo games label the bot side with its
	// strength so exported games replay with meaningful player names.
	const [userNameWhite, userNameBlack] = await Promise.all([
		playerName(loaded.whiteId),
		playerName(loaded.blackId)
	]);
	const seatNames = {
		white: loaded.whiteId ? userNameWhite : botSeatName(loaded.botLevel),
		black: loaded.blackId ? userNameBlack : botSeatName(loaded.botLevel)
	};
	const initialXfen = loaded.startFen ?? startPosition(loaded.variant).xfen;

	let finished: { result: ResultValue; termination: Termination } | null = outcome.finished;
	if (
		!finished &&
		drawByThreefold(loaded.variant, history, outcome.state.xfen, loaded.startFen ?? undefined)
	)
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
						whiteName: seatNames.white,
						blackName: seatNames.black,
						initialXfen,
						sanMoves: [...loaded.sanMoves, outcome.san],
						result: finished?.result ?? null,
						timeControlDescription: timeControlDescription(loaded.timeControl)
					})
				})
				.where(eq(games.id, gameId));
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

	// On-board finishes (mate, stalemate, variant wins, repetition, fifty-move)
	// finalize through completeGame so rated games get Glicko updates too.
	// When the claim is lost or throws, another path finished this game and owns
	// the result: report the move as unfinished so callers never broadcast a
	// conflicting outcome on top of the settled one.
	if (finished) {
		try {
			const claimed = await completeGame(gameId, finished.result, finished.termination);
			if (!claimed) finished = null;
		} catch (error) {
			console.error('[game] post-move finalize failed:', error);
			finished = null;
		}
	}

	return { applied: true, finished, state: outcome.state, san: outcome.san };
}

import { applyRatedResult } from '$lib/server/ratings/service';
import { speedClassFor } from './types';

/**
 * Finish a game and, when rated, apply Glicko-2 updates. Returns true when
 * this call claimed the finish. The claim is a single conditional UPDATE:
 * status flips started -> finished only while the row is still running and,
 * when guarded, unmoved since the caller read it. Concurrent finishes race on
 * that one statement, so exactly one of them reaches the rating step.
 */
export async function completeGame(
	gameId: string,
	result: ResultValue,
	termination: Termination,
	opts?: { onlyIfLastMoveAt?: Date }
): Promise<boolean> {
	const claim = [eq(games.id, gameId), eq(games.status, 'started')];
	if (opts?.onlyIfLastMoveAt) claim.push(eq(games.lastMoveAt, opts.onlyIfLastMoveAt));
	const [claimed] = await db
		.update(games)
		.set({ status: 'finished', result, termination, finishedAt: new Date() })
		.where(and(...claim))
		.returning({
			rated: games.rated,
			variant: games.variant,
			initialMs: games.initialMs,
			incrementMs: games.incrementMs,
			daysPerMove: games.daysPerMove,
			whiteId: games.whiteId,
			blackId: games.blackId
		});
	if (!claimed) return false;
	if (!claimed.rated) return true;
	await applyRatedResult({
		gameId,
		variant: claimed.variant as VariantId,
		speed: speedClassFor({
			initialMs: claimed.initialMs,
			incrementMs: claimed.incrementMs,
			daysPerMove: claimed.daysPerMove
		}),
		result,
		whiteId: claimed.whiteId,
		blackId: claimed.blackId
	});
	return true;
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

/** PGN label for an empty seat; solo games always have a bot level to show. */
function botSeatName(botLevel: number | null): string {
	if (botLevel != null) return `OpenBoard Bot (Level ${botLevel + 1})`;
	return 'Anonymous';
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
