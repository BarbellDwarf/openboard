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
		// The join path guards the claim on the last move it read.
		expect(gameService.completeGame).toHaveBeenCalledWith('flag-join', 'black', 'timeout', {
			onlyIfLastMoveAt: new Date(0)
		});
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
		// The background sweep holds no pre-read timestamp, so it claims unguarded.
		expect(gameService.completeGame).toHaveBeenCalledWith(
			'flag-sweep',
			'black',
			'timeout',
			undefined
		);
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

describe('finish claims', () => {
	function overs(room: string): Broadcast[] {
		return broadcasts.filter((b) => b.room === `game:${room}` && b.event === 'game:over');
	}

	it('broadcasts a resignation that wins the atomic claim', async () => {
		vi.setSystemTime(4_000_000_000);
		gameService.loadGame.mockResolvedValue(liveGame('resign-win'));
		await request(connect(), 'game:join', { gameId: 'resign-win' });

		gameService.playerColorFor.mockResolvedValue('white');
		gameService.completeGame.mockResolvedValue(true);
		await connect('user-w').trigger('game:resign', { gameId: 'resign-win' });

		expect(gameService.completeGame).toHaveBeenCalledWith('resign-win', 'black', 'resignation');
		expect(overs('resign-win')).toEqual([
			{
				room: 'game:resign-win',
				event: 'game:over',
				payload: { result: 'black', termination: 'resignation' }
			}
		]);
		// Winning the claim releases the clock for eviction.
		expect(evictIdleRooms(Number.MAX_SAFE_INTEGER)).toBe(1);
	});

	it('stays silent when a resignation loses the claim to a racing finish', async () => {
		vi.setSystemTime(4_100_000_000);
		gameService.loadGame.mockResolvedValue(liveGame('resign-race'));
		await request(connect(), 'game:join', { gameId: 'resign-race' });

		gameService.playerColorFor.mockResolvedValue('white');
		gameService.completeGame.mockResolvedValue(false);
		await connect('user-w').trigger('game:resign', { gameId: 'resign-race' });

		expect(gameService.completeGame).toHaveBeenCalledWith('resign-race', 'black', 'resignation');
		expect(overs('resign-race')).toHaveLength(0);
		// The other path owns the finish, so it also owns the clock release.
		expect(evictIdleRooms(Number.MAX_SAFE_INTEGER)).toBe(0);
	});

	it('stays silent when an accepted draw loses the claim', async () => {
		gameService.playerColorFor.mockResolvedValue('white');
		gameService.loadGame.mockResolvedValue(liveGame('draw-race'));
		await connect('user-w').trigger('game:draw-offer', { gameId: 'draw-race' });

		gameService.playerColorFor.mockResolvedValue('black');
		gameService.completeGame.mockResolvedValue(false);
		await connect('user-b').trigger('game:draw-accept', { gameId: 'draw-race' });

		expect(gameService.completeGame).toHaveBeenCalledWith('draw-race', 'draw', 'agreement');
		expect(overs('draw-race')).toHaveLength(0);
	});

	it('broadcasts an accepted draw that wins the claim', async () => {
		gameService.playerColorFor.mockResolvedValue('white');
		gameService.loadGame.mockResolvedValue(liveGame('draw-win'));
		await connect('user-w').trigger('game:draw-offer', { gameId: 'draw-win' });

		gameService.playerColorFor.mockResolvedValue('black');
		gameService.completeGame.mockResolvedValue(true);
		await connect('user-b').trigger('game:draw-accept', { gameId: 'draw-win' });

		expect(overs('draw-win')).toEqual([
			{
				room: 'game:draw-win',
				event: 'game:over',
				payload: { result: 'draw', termination: 'agreement' }
			}
		]);
	});

	it('guards flag finalization on the last move the caller read', async () => {
		const t0 = 4_200_000_000;
		vi.setSystemTime(t0);
		gameService.completeGame.mockResolvedValue(true);
		gameService.playerColorFor.mockResolvedValue('white');
		const game = liveGame('flag-guard', { state: { xfen: START_XFEN, turn: 'white' } });
		gameService.loadGame.mockResolvedValue(game);

		await request(connect(), 'game:join', { gameId: 'flag-guard' });
		expect(gameService.completeGame).not.toHaveBeenCalled();

		vi.setSystemTime(t0 + 61_000);
		const moved = await request(connect('user-w'), 'game:move', {
			gameId: 'flag-guard',
			uci: 'e2e4'
		});
		// The timeout claim rides with the timestamp the handler read, so a
		// move committing mid-finalize invalidates it instead of double-scoring.
		expect(gameService.completeGame).toHaveBeenCalledWith('flag-guard', 'black', 'timeout', {
			onlyIfLastMoveAt: new Date(0)
		});
		expect(moved).toEqual({ ok: false, reason: 'flag-fell' });
	});
});
