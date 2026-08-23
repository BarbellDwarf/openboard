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
	const lastStatement: { set?: unknown; where?: unknown } = {};
	const db = {
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
					return pendingReturning.length > 0 ? pendingReturning.shift() : [];
				}
			};
			return builder;
		}
	};
	return { db, pendingReturning, lastStatement };
});

vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

const ratingsMock = vi.hoisted(() => ({ applyRatedResult: vi.fn() }));
vi.mock('$lib/server/ratings/service', () => ratingsMock);

import { completeGame } from './game-service';

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
	dbMock.lastStatement.set = undefined;
	dbMock.lastStatement.where = undefined;
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
