import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * completeGame claims the finish with one conditional UPDATE ... WHERE
 * status='started' ... RETURNING. These tests script that statement's result
 * the way PostgreSQL would decide it under concurrency: exactly one racer
 * gets the row, everyone else gets nothing and must not touch ratings.
 */

const dbMock = vi.hoisted(() => {
	const pendingReturning: unknown[][] = [];
	// FIFO of result sets consumed by awaited select terminals, in call order.
	const pendingSelects: unknown[][] = [];
	const lastStatement: { set?: unknown; where?: unknown } = {};
	let updateFailure: Error | null = null;

	function selectBuilder() {
		const builder = {
			from: () => builder,
			where: () => builder,
			async orderBy() {
				return pendingSelects.length > 0 ? pendingSelects.shift() : [];
			},
			async limit() {
				return pendingSelects.length > 0 ? pendingSelects.shift() : [];
			}
		};
		return builder;
	}

	const db = {
		select: () => selectBuilder(),
		update(_table: unknown) {
			const builder = {
				set(values: unknown) {
					lastStatement.set = values;
					return builder;
				},
				where(condition: unknown) {
					lastStatement.where = condition;
					return builder;
				},
				async returning() {
					if (updateFailure) throw updateFailure;
					return pendingReturning.length > 0 ? pendingReturning.shift() : [];
				}
			};
			return builder;
		},
		insert(_table: unknown) {
			const builder = {
				values: async () => {}
			};
			return builder;
		},
		async transaction(callback: (tx: unknown) => Promise<unknown>) {
			return callback({
				insert: () => ({ values: async () => {} }),
				update(_table: unknown) {
					const builder = {
						set(values: unknown) {
							lastStatement.set = values;
							return builder;
						},
						where: async () => {}
					};
					return builder;
				}
			});
		}
	};
	return {
		db,
		pendingReturning,
		pendingSelects,
		lastStatement,
		failNextUpdateWith(error: Error) {
			updateFailure = error;
		},
		clearUpdateFailure() {
			updateFailure = null;
		}
	};
});

vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

const ratingsMock = vi.hoisted(() => ({ applyRatedResult: vi.fn() }));
vi.mock('$lib/server/ratings/service', () => ratingsMock);

import { completeGame, persistMove } from './game-service';
import { applyMove, chess960StartFen, loadPosition, startPosition } from './engine';

const ratedRow = {
	rated: true,
	variant: 'standard',
	initialMs: 300_000,
	incrementMs: 2_000,
	daysPerMove: null,
	whiteId: '11111111-1111-1111-1111-111111111111',
	blackId: '22222222-2222-2222-2222-222222222222'
};

beforeEach(() => {
	dbMock.pendingReturning.length = 0;
	dbMock.pendingSelects.length = 0;
	dbMock.lastStatement.set = undefined;
	dbMock.lastStatement.where = undefined;
	dbMock.clearUpdateFailure();
	ratingsMock.applyRatedResult.mockReset();
	ratingsMock.applyRatedResult.mockResolvedValue(undefined);
});

describe('atomic game finalization', () => {
	it('claims the row once when two finishes race, rating exactly once', async () => {
		// First UPDATE ... RETURNING wins the row; the concurrent loser reads
		// an empty result because status is no longer 'started'.
		dbMock.pendingReturning.push([ratedRow]);
		const outcomes = await Promise.all([
			completeGame('game-1', 'white', 'timeout'),
			completeGame('game-1', 'white', 'resignation')
		]);
		expect(outcomes).toEqual([true, false]);
		expect(ratingsMock.applyRatedResult).toHaveBeenCalledTimes(1);
		expect(ratingsMock.applyRatedResult).toHaveBeenCalledWith(
			expect.objectContaining({
				gameId: 'game-1',
				result: 'white',
				variant: 'standard',
				whiteId: ratedRow.whiteId,
				blackId: ratedRow.blackId
			})
		);
	});

	it('skips ratings when the claim finds nothing to update', async () => {
		await expect(completeGame('missing-game', 'draw', 'agreement')).resolves.toBe(false);
		expect(ratingsMock.applyRatedResult).not.toHaveBeenCalled();
	});

	it('applies no ratings to unrated games even when the claim succeeds', async () => {
		dbMock.pendingReturning.push([{ ...ratedRow, rated: false }]);
		await expect(completeGame('casual-game', 'black', 'checkmate')).resolves.toBe(true);
		expect(ratingsMock.applyRatedResult).not.toHaveBeenCalled();
	});

	it('folds the sweeper guard into the claim condition itself', async () => {
		dbMock.pendingReturning.push([ratedRow]);
		await completeGame('guarded-game', 'white', 'timeout', {
			onlyIfLastMoveAt: new Date(5_000)
		});
		const { sql } = new PgDialect().sqlToQuery(dbMock.lastStatement.where as SQL);
		expect(sql).toContain('"games"."status"');
		expect(sql).toContain('"games"."last_move_at"');
	});

	it('writes the finished state in the claim statement', async () => {
		dbMock.pendingReturning.push([]);
		await completeGame('game-2', 'draw', 'fifty-moves');
		expect(dbMock.lastStatement.set).toMatchObject({
			status: 'finished',
			result: 'draw',
			termination: 'fifty-moves'
		});
	});
});

describe('post-move finish reporting', () => {
	// Position after 1. f3 e5 2. g4, black to move: d8h4 lands checkmate.
	// loadGame rebuilds positions by replaying move rows, so the fixture
	// derives both the history rows and the final xfen through the real engine.
	function preMateFixture(): {
		rows: Array<{ ply: number; uci: string; san: string }>;
		xfen: string;
	} {
		let state = startPosition('standard');
		const rows = ['f2f3', 'e7e5', 'g2g4'].map((uci, index) => {
			const applied = applyMove('standard', state.xfen, uci);
			if (!applied.ok) throw new Error(`${uci} must be legal`);
			state = applied.state;
			return { ply: index + 1, uci, san: applied.san };
		});
		return { rows, xfen: state.xfen };
	}

	function startedRow(currentXfen: string) {
		return {
			id: 'game-pm',
			variant: 'standard',
			rated: false,
			status: 'started',
			result: null,
			termination: null,
			initialMs: null,
			incrementMs: null,
			daysPerMove: null,
			currentXfen,
			pgn: null,
			moveCount: 3,
			whiteId: '11111111-1111-1111-1111-111111111111',
			blackId: '22222222-2222-2222-2222-222222222222',
			createdAt: new Date(1_000),
			startedAt: new Date(1_000),
			finishedAt: null,
			lastMoveAt: new Date(2_000)
		};
	}

	async function playMatingMove(): Promise<Awaited<ReturnType<typeof persistMove>>> {
		const fixture = preMateFixture();
		dbMock.pendingSelects.push(
			[startedRow(fixture.xfen)],
			fixture.rows,
			fixture.rows.map(() => ({ xfenAfter: 'n/a' }))
		);
		return persistMove('game-pm', 'd8h4');
	}

	it('reports the finish when its own finalize claims the row', async () => {
		dbMock.pendingReturning.push([
			{ rated: false, variant: 'standard', initialMs: null, incrementMs: null, daysPerMove: null }
		]);
		const result = await playMatingMove();
		expect(result.applied).toBe(true);
		expect(result.finished).toEqual({ result: 'black', termination: 'checkmate' });
	});

	it('reports unfinished when its own finalize threw', async () => {
		// The row stays started while the finalize failed; reporting finished
		// would make clients score a game the database never closed.
		dbMock.failNextUpdateWith(new Error('finalize exploded'));
		const result = await playMatingMove();
		expect(result.applied).toBe(true);
		expect(result.finished).toBeNull();
	});

	it('reports unfinished when a racing path already claimed the finish', async () => {
		// A flag sweeper won the conditional UPDATE; its result owns the room.
		dbMock.pendingReturning.push([]);
		const result = await playMatingMove();
		expect(result.applied).toBe(true);
		expect(result.finished).toBeNull();
	});
});

describe('stored PGN correctness', () => {
	// First move of a fresh two-player game; loadGame replays zero rows, so
	// the pre-move position equals the variant's start xfen exactly.
	function freshGameRow(
		variant: 'standard' | 'chess960' | 'racingkings',
		startXfen: string,
		extra = {}
	) {
		return {
			id: 'game-pgn',
			variant,
			rated: false,
			status: 'started',
			result: null,
			termination: null,
			initialMs: 300_000,
			incrementMs: 2_000,
			daysPerMove: null,
			currentXfen: startXfen,
			pgn: null,
			moveCount: 0,
			whiteId: '11111111-1111-1111-1111-111111111111',
			blackId: '22222222-2222-2222-2222-222222222222',
			botLevel: null,
			createdAt: new Date(1_000),
			startedAt: new Date(1_000),
			finishedAt: null,
			lastMoveAt: new Date(2_000),
			...extra
		};
	}

	async function playFirstMove(
		variant: 'standard' | 'chess960' | 'racingkings',
		extra = {},
		names: string[] = ['Alice', 'Bob']
	): Promise<string> {
		// Any legal opening move; hardcoded pawn pushes are illegal in some
		// variants such as Racing Kings. A stored startFen (shuffled Chess960)
		// seeds both the row and the move choice.
		const startFen =
			typeof (extra as { startFen?: string }).startFen === 'string'
				? (extra as { startFen: string }).startFen
				: startPosition(variant).xfen;
		const state = loadPosition(variant, startFen);
		const [from, tos] = Object.entries(state.dests)[0];
		dbMock.pendingSelects.push([freshGameRow(variant, state.xfen, extra)], []);
		dbMock.pendingSelects.push([], ...names.map((name) => [{ name }]));
		await persistMove('game-pgn', `${from}${tos[0]}`);
		const set = dbMock.lastStatement.set as { pgn?: string } | undefined;
		return String(set?.pgn);
	}

	it('embeds SetUp/FEN and real seat names for non-standard variants', async () => {
		// Racing Kings starts from a different board entirely, so without the
		// FEN header exporters would replay the game from the standard array.
		const startXfen = startPosition('racingkings').xfen;
		const pgn = await playFirstMove('racingkings');
		expect(pgn).toContain('[Variant "Racing Kings"]');
		expect(pgn).toContain('[SetUp "1"]');
		expect(pgn).toContain(`[FEN "${startXfen}"]`);
		expect(pgn).toContain('[White "Alice"]');
		expect(pgn).toContain('[Black "Bob"]');
	});

	it('omits SetUp/FEN when the variant start equals the standard array', async () => {
		// A Chess960 row without a stored startFen is a legacy row that began
		// from the default array, identical to the standard start string, so
		// buildPgn's dedup keeps the PGN clean and replay from the implicit
		// standard start stays correct.
		const pgn = await playFirstMove('chess960');
		expect(pgn).toContain('[Variant "Chess960"]');
		expect(pgn).not.toContain('[SetUp');
		expect(pgn).not.toContain('[FEN ');
	});

	it('embeds the stored Chess960 array in SetUp/FEN', async () => {
		// A shuffled game stores its back rank at creation. persistMove must
		// read that stored start, not a fresh default array, or exports would
		// replay from the wrong position.
		const shuffled = chess960StartFen(() => 0.5);
		const pgn = await playFirstMove('chess960', { startFen: shuffled });
		expect(pgn).toContain('[Variant "Chess960"]');
		expect(pgn).toContain('[SetUp "1"]');
		expect(pgn).toContain(`[FEN "${shuffled}"]`);
	});

	it('labels the bot seat with its strength in solo games', async () => {
		// Solo game: black seat is a level-id 2 bot ("Level 3" in the lobby UI).
		// playerName skips its query for the null seat, so one name select runs.
		const pgn = await playFirstMove('standard', { blackId: null, botLevel: 2 }, ['Alice']);
		expect(pgn).toContain('[White "Alice"]');
		expect(pgn).toContain('[Black "OpenBoard Bot (Level 3)"]');
	});

	it('keeps standard-chess headers byte-shaped without SetUp/FEN or Variant', async () => {
		const pgn = await playFirstMove('standard');
		expect(pgn.split('\n\n')[0].split('\n')).toEqual([
			'[Event "OpenBoard casual game"]',
			'[Site "OpenBoard"]',
			`[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`,
			'[White "Alice"]',
			'[Black "Bob"]',
			'[Result "*"]',
			'[TimeControl "300+2"]'
		]);
	});
});
