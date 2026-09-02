import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The correspondence sweeper runs two passes. The finalize pass claims
 * flagged games through completeGame's guarded claim and notifies both
 * seats only on a won claim. The reminder pass warns the player on the
 * move once their clock drops under a quarter of the budget, exactly once
 * per game per player, in-app always and by email only while SMTP exists.
 */

const dbMock = vi.hoisted(() => {
	const refs: Record<string, unknown> = {};
	let gameRows: Array<Record<string, unknown>> = [];
	let reminderRows: Array<Record<string, unknown>> = [];
	let userRows: Array<Record<string, unknown>> = [];
	const inserts: Array<Record<string, unknown>> = [];
	let insertWins = true;

	function rowsFor(table: unknown): Array<Record<string, unknown>> {
		if (table === refs.games) return gameRows;
		if (table === refs.reminders) return reminderRows;
		if (table === refs.users) return userRows;
		return [];
	}

	const db = {
		select: () => {
			const builder: Record<string, unknown> = {};
			builder.from = (table: unknown) => {
				// Awaitable where-result that also supports a trailing .limit().
				const pending = rowsFor(table);
				const result = Promise.resolve(pending) as unknown as typeof pending & {
					limit: () => Promise<Array<Record<string, unknown>>>;
				};
				result.limit = async () => pending;
				builder.where = () => result;
				return builder;
			};
			return builder;
		},
		insert: () => ({
			values: (values: Record<string, unknown>) => ({
				onConflictDoNothing: () => ({
					returning: async () => {
						inserts.push(values);
						return insertWins ? [values] : [];
					}
				})
			})
		})
	};

	return {
		db,
		refs,
		setRows(rows: Array<Record<string, unknown>>) {
			gameRows = rows;
		},
		setReminderRows(rows: Array<Record<string, unknown>>) {
			reminderRows = rows;
		},
		setUserRows(rows: Array<Record<string, unknown>>) {
			userRows = rows;
		},
		setInsertWins(wins: boolean) {
			insertWins = wins;
		},
		inserts
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

const mailMock = vi.hoisted(() => ({
	isMailConfigured: vi.fn(() => false),
	sendMail: vi.fn(async () => true)
}));
vi.mock('$lib/server/mail', () => mailMock);

import type { PgTable } from 'drizzle-orm/pg-core';
import { correspondenceReminders, games, users } from '../db/schema';
import { remindDuePlayers, sweepOnce } from './index';

// Table identities resolve lazily: the hoisted factory runs before imports.
dbMock.refs.games = games as unknown as PgTable;
dbMock.refs.reminders = correspondenceReminders as unknown as PgTable;
dbMock.refs.users = users as unknown as PgTable;

function rowWithRemaining(overrides: Record<string, unknown> = {}) {
	// Four-day budget; a quarter of that is 24h of slack.
	const daysPerMove = 4;
	const hoursLeft = typeof overrides.hoursLeft === 'number' ? overrides.hoursLeft : 12;
	const rest: Record<string, unknown> = { ...overrides };
	delete rest.hoursLeft;
	return {
		id: 'corr-game',
		daysPerMove,
		lastMoveAt: new Date(Date.now() - (daysPerMove * 24 - hoursLeft) * 60 * 60 * 1000),
		// Black is to move throughout these fixtures.
		currentXfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
		whiteId: 'user-w',
		blackId: 'user-b',
		...rest
	};
}

function flaggedRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'corr-game',
		daysPerMove: 1,
		lastMoveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
		currentXfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
		whiteId: 'user-w',
		blackId: 'user-b',
		...overrides
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	gameServiceMock.completeGame.mockResolvedValue(true);
	mailMock.isMailConfigured.mockReturnValue(false);
	dbMock.setRows([]);
	dbMock.setReminderRows([]);
	dbMock.setUserRows([]);
	dbMock.setInsertWins(true);
	dbMock.inserts.length = 0;
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

describe('remindDuePlayers', () => {
	it('warns the player on the move once the clock is low, in-app first', async () => {
		dbMock.setRows([rowWithRemaining({ hoursLeft: 12 })]);

		await expect(remindDuePlayers()).resolves.toBe(1);

		expect(notificationsMock.notifyUser).toHaveBeenCalledTimes(1);
		expect(notificationsMock.notifyUser).toHaveBeenCalledWith(
			'user-b',
			'reminder',
			expect.objectContaining({ url: '/game/corr-game' })
		);
		expect(mailMock.sendMail).not.toHaveBeenCalled();
	});

	it('emails the reminder only while SMTP is configured', async () => {
		mailMock.isMailConfigured.mockReturnValue(true);
		dbMock.setRows([rowWithRemaining({ hoursLeft: 6 })]);
		dbMock.setUserRows([{ email: 'black@example.com' }]);

		await expect(remindDuePlayers()).resolves.toBe(1);

		expect(mailMock.sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'black@example.com' })
		);
	});

	it('stays silent while most of the clock remains', async () => {
		dbMock.setRows([rowWithRemaining({ hoursLeft: 48 })]);

		await expect(remindDuePlayers()).resolves.toBe(0);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
		expect(dbMock.inserts).toEqual([]);
	});

	it('leaves flagged games to the finalize pass', async () => {
		dbMock.setRows([rowWithRemaining({ hoursLeft: -5 })]);

		await expect(remindDuePlayers()).resolves.toBe(0);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
	});

	it('reminds each player once per game, never twice', async () => {
		dbMock.setRows([rowWithRemaining({ hoursLeft: 3 })]);
		dbMock.setReminderRows([{ gameId: 'corr-game', userId: 'user-b' }]);

		await expect(remindDuePlayers()).resolves.toBe(0);
		expect(dbMock.inserts).toEqual([]);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
	});

	it('skips an empty seat on the move', async () => {
		dbMock.setRows([rowWithRemaining({ hoursLeft: 3, blackId: null })]);

		await expect(remindDuePlayers()).resolves.toBe(0);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
	});

	it('does not notify when another sweep won the insert', async () => {
		dbMock.setRows([rowWithRemaining({ hoursLeft: 3 })]);
		dbMock.setInsertWins(false);

		await expect(remindDuePlayers()).resolves.toBe(0);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
	});

	it('targets White instead when it is their move', async () => {
		dbMock.setRows([
			rowWithRemaining({
				hoursLeft: 2,
				currentXfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
			})
		]);

		await expect(remindDuePlayers()).resolves.toBe(1);
		expect(notificationsMock.notifyUser).toHaveBeenCalledWith(
			'user-w',
			'reminder',
			expect.anything()
		);
	});
});
