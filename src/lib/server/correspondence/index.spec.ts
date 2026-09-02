import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The correspondence sweeper finalizes flagged games through completeGame's
 * guarded claim. These tests pin the review findings: only won claims count
 * and notify, and seat ids are never fabricated for empty seats.
 */

const dbMock = vi.hoisted(() => {
	let pendingRows: unknown[] = [];
	const db = {
		select: () => {
			const builder = {
				from: () => builder,
				where: async () => pendingRows
			};
			return builder;
		}
	};
	return {
		db,
		setRows(rows: unknown[]) {
			pendingRows = rows;
		}
	};
});
vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

const gameServiceMock = vi.hoisted(() => ({
	completeGame: vi.fn()
}));
vi.mock('$lib/server/chess/game-service', () => gameServiceMock);

const notificationsMock = vi.hoisted(() => ({
	notifyUser: vi.fn(async (_userId: string, _type: string, _payload?: unknown) => {})
}));
vi.mock('$lib/server/notifications', () => notificationsMock);

import { sweepOnce } from './index';

function flaggedRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'corr-game',
		daysPerMove: 1,
		lastMoveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
		// Black is to move, so a flag fall awards the game to White.
		currentXfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
		whiteId: 'user-w',
		blackId: 'user-b',
		...overrides
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	gameServiceMock.completeGame.mockResolvedValue(true);
});

describe('sweepOnce', () => {
	it('notifies both seats and counts a won claim once', async () => {
		dbMock.setRows([flaggedRow()]);
		await expect(sweepOnce()).resolves.toBe(1);

		expect(gameServiceMock.completeGame).toHaveBeenCalledWith(
			'corr-game',
			'white',
			'timeout',
			expect.objectContaining({ onlyIfLastMoveAt: expect.any(Date) })
		);
		expect(notificationsMock.notifyUser).toHaveBeenCalledTimes(2);
		expect(notificationsMock.notifyUser).toHaveBeenCalledWith(
			'user-w',
			'game-result',
			expect.objectContaining({ url: '/game/corr-game' })
		);
		expect(notificationsMock.notifyUser).toHaveBeenCalledWith(
			'user-b',
			'game-result',
			expect.anything()
		);
	});

	it('counts nothing and stays quiet when the claim was lost', async () => {
		dbMock.setRows([flaggedRow({ id: 'lost-race' })]);
		gameServiceMock.completeGame.mockResolvedValue(false);

		await expect(sweepOnce()).resolves.toBe(0);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
	});

	it('never fabricates a seat id for an empty seat', async () => {
		// An empty seat stores NULL; inserting '' into a uuid NOT NULL column
		// would be an unhandled rejection one schema change away.
		dbMock.setRows([
			flaggedRow({ id: 'seatless', whiteId: null }),
			flaggedRow({ id: 'seatless-2', blackId: null })
		]);

		await expect(sweepOnce()).resolves.toBe(2);
		expect(notificationsMock.notifyUser).toHaveBeenCalledTimes(2);
		const recipients = notificationsMock.notifyUser.mock.calls.map((call) => call[0]);
		expect(recipients).toEqual(['user-b', 'user-w']);
	});

	it('skips games that are not correspondence or have never been moved', async () => {
		dbMock.setRows([
			flaggedRow({ id: 'live-game', daysPerMove: null }),
			flaggedRow({ id: 'fresh-game', lastMoveAt: null })
		]);

		await expect(sweepOnce()).resolves.toBe(0);
		expect(gameServiceMock.completeGame).not.toHaveBeenCalled();
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
	});
});
