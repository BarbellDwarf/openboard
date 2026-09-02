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
				update: () => ({ set: () => ({ where: async () => {} }) })
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
import { applyMove, startPosition } from './engine';

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
