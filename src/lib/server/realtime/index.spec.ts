import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server as IOServer } from 'socket.io';

/**
 * Drives the gateway's connection handlers against mocked persistence so the
 * lazy-flag paths, clock resume, and room lifecycle stay honest end to end.
 */

const gameService = vi.hoisted(() => ({
	loadGame: vi.fn(),
	completeGame: vi.fn(),
	persistMove: vi.fn(),
	createGame: vi.fn(),
	playerColorFor: vi.fn()
}));
vi.mock('$lib/server/chess/game-service', () => gameService);

const notificationsMock = vi.hoisted(() => ({ notifyUser: vi.fn() }));
vi.mock('$lib/server/notifications', () => notificationsMock);

vi.mock('$lib/server/db', () => ({ closePool: vi.fn(async () => {}) }));
vi.mock('$lib/server/auth/session', () => ({
	getSessionFromCookieHeader: vi.fn(async () => null)
}));
vi.mock('$lib/server/correspondence', () => ({ startSweeper: vi.fn() }));
vi.mock('$lib/server/chat', () => ({
	addMessage: vi.fn(async () => 'message-1'),
	historyFor: vi.fn(async () => [])
}));

import { evictIdleRooms, injectSocketIO, sweepFlaggedRooms } from './index';

type Handler = (...args: unknown[]) => unknown;

interface Broadcast {
	room: string;
	event: string;
	payload?: unknown;
}

const broadcasts: Broadcast[] = [];

class FakeSocket {
	data: { userId?: string | null; userName?: string } = {};
	private handlers = new Map<string, Handler>();

	on(event: string, handler: unknown): void {
		this.handlers.set(event, handler as Handler);
	}

	async join(_room: string): Promise<void> {}

	to(room: string): { emit(event: string, payload?: unknown): void } {
		return {
			emit: (event: string, payload?: unknown) => {
				broadcasts.push({ room, event, payload });
			}
		};
	}

	trigger(event: string, ...args: unknown[]): Promise<unknown> {
		const handler = this.handlers.get(event);
		if (!handler) throw new Error(`no handler registered for ${event}`);
		return Promise.resolve(handler(...args));
	}
}

let onConnection: ((socket: FakeSocket) => void) | undefined;

injectSocketIO({
	use: (_middleware: unknown) => {},
	on: (event: string, handler: (socket: FakeSocket) => void) => {
		if (event === 'connection') onConnection = handler;
	},
	to: (room: string) => ({
		emit: (event: string, payload?: unknown) => broadcasts.push({ room, event, payload })
	})
} as unknown as IOServer);

function connect(userId: string | null = null): FakeSocket {
	const socket = new FakeSocket();
	socket.data.userId = userId;
	onConnection?.(socket);
	return socket;
}

async function request(
	socket: FakeSocket,
	event: string,
	payload: unknown
): Promise<Record<string, unknown>> {
	let response: Record<string, unknown> = {};
	await socket.trigger(event, payload, (ack: unknown) => {
		response = ack as Record<string, unknown>;
	});
	return response;
}

const START_XFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function liveGame(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		variant: 'standard',
		rated: false,
		status: 'started',
		result: null,
		termination: null,
		timeControl: { initialMs: 60_000, incrementMs: 5_000, daysPerMove: null },
		whiteId: 'user-w',
		blackId: 'user-b',
		state: { xfen: START_XFEN },
		sanMoves: [],
		lastMoveAtMs: 0,
		...overrides
	};
}

afterEach(async () => {
	// Drain every room between tests: finalize outstanding flags, then evict.
	gameService.completeGame.mockResolvedValue(true);
	gameService.loadGame.mockResolvedValue(null);
	await sweepFlaggedRooms(Number.MAX_SAFE_INTEGER);
	evictIdleRooms(Number.MAX_SAFE_INTEGER);
	vi.clearAllMocks();
	vi.useRealTimers();
});

describe('lazy flag finalization', () => {
	it('finalizes a fallen flag when a player rejoins', async () => {
		const t0 = 1_000_000_000;
		vi.setSystemTime(t0);
		gameService.completeGame.mockResolvedValue(true);
		gameService.playerColorFor.mockResolvedValue('white');
		const started = liveGame('flag-join');
		const finished = { ...started, status: 'finished', result: 'black', termination: 'timeout' };
		let loads = 0;
		gameService.loadGame.mockImplementation(async () => {
			loads += 1;
			return loads <= 2 ? started : finished;
		});

		const first = await request(connect('user-w'), 'game:join', { gameId: 'flag-join' });
		expect(first.ok).toBe(true);
		expect(gameService.completeGame).not.toHaveBeenCalled();

		vi.setSystemTime(t0 + 61_000);
		const second = await request(connect('user-b'), 'game:join', { gameId: 'flag-join' });
		expect(gameService.completeGame).toHaveBeenCalledWith('flag-join', 'black', 'timeout');
		expect(second.game).toMatchObject({ status: 'finished', result: 'black' });
		expect(broadcasts).toContainEqual({
			room: 'game:flag-join',
			event: 'game:over',
			payload: { result: 'black', termination: 'timeout' }
		});
	});

	it('sweeps flagged games nobody is watching', async () => {
		const t0 = 2_000_000_000;
		vi.setSystemTime(t0);
		gameService.loadGame.mockResolvedValue(liveGame('flag-sweep'));
		await request(connect(), 'game:join', { gameId: 'flag-sweep' });
		expect(gameService.completeGame).not.toHaveBeenCalled();

		vi.setSystemTime(t0 + 61_000);
		await expect(sweepFlaggedRooms()).resolves.toBe(1);
		expect(gameService.completeGame).toHaveBeenCalledWith('flag-sweep', 'black', 'timeout');
		const overs = broadcasts.filter((b) => b.room === 'game:flag-sweep' && b.event === 'game:over');
		expect(overs).toHaveLength(1);
	});
});

describe('clock resume across a restart', () => {
	it('does not charge downtime to the side to move', async () => {
		const outageBeganAt = 500_000_000;
		const resumedAt = outageBeganAt + 5 * 3_600_000;
		vi.setSystemTime(resumedAt);
		gameService.loadGame.mockResolvedValue(
			liveGame('resume-game', { lastMoveAtMs: outageBeganAt })
		);

		const joined = await request(connect(), 'game:join', { gameId: 'resume-game' });
		// Charging the outage would leave max(0, 60_000 - 18_000_000) = 0.
		expect(joined.clock).toEqual({ whiteMs: 60_000, blackMs: 60_000, ticking: 'white' });

		vi.setSystemTime(resumedAt + 5_000);
		const fiveSecondsLater = await request(connect(), 'game:join', { gameId: 'resume-game' });
		expect(fiveSecondsLater.clock).toEqual({
			whiteMs: 55_000,
			blackMs: 60_000,
			ticking: 'white'
		});
	});
});

describe('room lifecycle', () => {
	it('reclaims a room once its game finishes', async () => {
		const t0 = 3_000_000_000;
		vi.setSystemTime(t0);
		gameService.loadGame.mockResolvedValue(liveGame('evict-game'));
		await request(connect(), 'game:join', { gameId: 'evict-game' });
		// While the clock runs, eviction must leave the room alone.
		expect(evictIdleRooms(Number.MAX_SAFE_INTEGER)).toBe(0);

		vi.setSystemTime(t0 + 61_000);
		await sweepFlaggedRooms();
		// Completion released the clock, so idle eviction can reclaim the room.
		expect(evictIdleRooms(Number.MAX_SAFE_INTEGER)).toBe(1);
		expect(evictIdleRooms(Number.MAX_SAFE_INTEGER)).toBe(0);
	});
});

describe('draw offers', () => {
	it('loads the game once to find the opponent', async () => {
		gameService.playerColorFor.mockResolvedValue('white');
		gameService.loadGame.mockResolvedValue(liveGame('offer-game'));
		await connect('user-w').trigger('game:draw-offer', { gameId: 'offer-game' });
		expect(gameService.loadGame).toHaveBeenCalledTimes(1);
		expect(notificationsMock.notifyUser).toHaveBeenCalledWith(
			'user-b',
			'draw-offered',
			expect.objectContaining({ url: '/game/offer-game' })
		);
		expect(broadcasts).toContainEqual({
			room: 'game:offer-game',
			event: 'game:draw-offered',
			payload: { by: 'white' }
		});
	});
});
