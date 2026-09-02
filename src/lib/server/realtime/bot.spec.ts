import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server as IOServer } from 'socket.io';

/**
 * Drives the house-bot paths against mocked persistence and a mocked search:
 * scheduling collapses re-triggers, the DB row gates every attempt, a plain
 * join self-heals a stalled solo game after a restart, and bot moves flow
 * through the same persist/broadcast path human moves use.
 */

const gameService = vi.hoisted(() => ({
	loadGame: vi.fn(),
	completeGame: vi.fn(),
	persistMove: vi.fn(),
	createGame: vi.fn(),
	playerColorFor: vi.fn()
}));
vi.mock('$lib/server/chess/game-service', () => gameService);

const searchMock = vi.hoisted(() => ({ chooseBotMove: vi.fn() }));
vi.mock('$lib/client/bot/search', () => searchMock);

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
	/** Direct emits to this socket only, e.g. the house declining a draw. */
	emitted: { event: string; payload?: unknown }[] = [];
	private handlers = new Map<string, Handler>();

	on(event: string, handler: unknown): void {
		this.handlers.set(event, handler as Handler);
	}

	async join(_room: string): Promise<void> {}

	emit(event: string, payload?: unknown): void {
		this.emitted.push({ event, payload });
	}

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

/** Fire any pending bot timer and let its move settle fully. */
async function flushBotTurns(): Promise<void> {
	await vi.advanceTimersByTimeAsync(2_000);
}

const START_XFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_XFEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1';

/**
 * A solo game where the human sits white, the house sits black, and white
 * already opened with e4: the empty seat is on turn, waiting for the bot.
 */
function soloGame(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		variant: 'standard',
		rated: false,
		status: 'started',
		result: null,
		termination: null,
		timeControl: { initialMs: 60_000, incrementMs: 5_000, daysPerMove: null },
		whiteId: 'user-w',
		blackId: null,
		botLevel: 2,
		state: { xfen: AFTER_E4_XFEN, turn: 'black' },
		sanMoves: ['e4'],
		lastMoveAtMs: 0,
		...overrides
	};
}

/** Feed loadGame results in order; the last one repeats forever. */
function loadsIn(...games: Record<string, unknown>[]): void {
	let reads = 0;
	gameService.loadGame.mockImplementation(async () => {
		const next = games[Math.min(reads, games.length - 1)];
		reads += 1;
		return next;
	});
}

afterEach(async () => {
	gameService.completeGame.mockResolvedValue(true);
	gameService.loadGame.mockResolvedValue(null);
	await sweepFlaggedRooms(Number.MAX_SAFE_INTEGER);
	evictIdleRooms(Number.MAX_SAFE_INTEGER);
	broadcasts.length = 0;
	vi.clearAllMocks();
	vi.useRealTimers();
});

describe('server-side bot turns', () => {
	it('collapses re-triggers while one think delay is pending', async () => {
		vi.useFakeTimers();
		loadsIn(soloGame('collapse'));
		searchMock.chooseBotMove.mockReturnValue('e7e5');
		gameService.persistMove.mockResolvedValue({
			applied: true,
			san: 'e5',
			state: { xfen: START_XFEN },
			finished: null
		});
		const socket = connect();

		await request(socket, 'game:join', { gameId: 'collapse' });
		await request(socket, 'game:join', { gameId: 'collapse' });
		await request(socket, 'game:join', { gameId: 'collapse' });

		// The think delay always exceeds 600ms, so nothing may have run yet.
		await vi.advanceTimersByTimeAsync(599);
		expect(searchMock.chooseBotMove).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1_001);
		expect(searchMock.chooseBotMove).toHaveBeenCalledTimes(1);
		expect(gameService.persistMove).toHaveBeenCalledTimes(1);
	});

	it('skips when both seats are occupied', async () => {
		vi.useFakeTimers();
		loadsIn(soloGame('full-game', { blackId: 'user-b' }));

		const joined = await request(connect(), 'game:join', { gameId: 'full-game' });
		expect(joined.ok).toBe(true);
		await flushBotTurns();

		expect(searchMock.chooseBotMove).not.toHaveBeenCalled();
		expect(gameService.persistMove).not.toHaveBeenCalled();
	});

	it('skips when it is not the empty seat’s turn', async () => {
		vi.useFakeTimers();
		loadsIn(soloGame('wrong-turn', { state: { xfen: START_XFEN, turn: 'white' }, sanMoves: [] }));

		await request(connect(), 'game:join', { gameId: 'wrong-turn' });
		await flushBotTurns();

		expect(searchMock.chooseBotMove).not.toHaveBeenCalled();
		expect(gameService.persistMove).not.toHaveBeenCalled();
	});

	it('skips when the game is already finished', async () => {
		vi.useFakeTimers();
		loadsIn(
			soloGame('done-game', { status: 'finished', result: 'white', termination: 'resignation' })
		);

		await request(connect(), 'game:join', { gameId: 'done-game' });
		await flushBotTurns();

		expect(searchMock.chooseBotMove).not.toHaveBeenCalled();
		expect(gameService.persistMove).not.toHaveBeenCalled();
	});

	it('skips when no house bot is assigned to the game', async () => {
		vi.useFakeTimers();
		loadsIn(soloGame('open-challenge', { botLevel: null }));

		await request(connect(), 'game:join', { gameId: 'open-challenge' });
		await flushBotTurns();

		expect(searchMock.chooseBotMove).not.toHaveBeenCalled();
		expect(gameService.persistMove).not.toHaveBeenCalled();
	});

	it('self-heals a stalled solo game when anyone joins after a restart', async () => {
		vi.useFakeTimers();
		// A fresh module simulates a restarted process: no timers, no rooms.
		// Only the database remembers the bot owes a reply to e4.
		loadsIn(soloGame('heal'));
		searchMock.chooseBotMove.mockReturnValue('e7e5');
		gameService.persistMove.mockResolvedValue({
			applied: true,
			san: 'e5',
			state: { xfen: START_XFEN },
			finished: null
		});

		const joined = await request(connect(), 'game:join', { gameId: 'heal' });
		expect(joined.ok).toBe(true);
		await flushBotTurns();

		expect(searchMock.chooseBotMove).toHaveBeenCalledWith('standard', AFTER_E4_XFEN, 2);
		expect(gameService.persistMove).toHaveBeenCalledWith('heal', 'e7e5');
		const moved = broadcasts.filter((b) => b.room === 'game:heal' && b.event === 'game:moved');
		expect(moved).toHaveLength(1);
		expect(moved[0].payload).toMatchObject({ gameId: 'heal', ply: 2, uci: 'e7e5', san: 'e5' });
		// The mock reports no on-board finish, so no result event may appear.
		expect(
			broadcasts.filter((b) => b.room === 'game:heal' && b.event === 'game:over')
		).toHaveLength(0);
	});

	it('stays silent when the bot loses the unique(game_id, ply) race', async () => {
		vi.useFakeTimers();
		loadsIn(soloGame('ply-race'));
		searchMock.chooseBotMove.mockReturnValue('e7e5');
		gameService.persistMove.mockResolvedValue({ applied: false, reason: 'already-moved' });

		await request(connect(), 'game:join', { gameId: 'ply-race' });
		await flushBotTurns();

		expect(gameService.persistMove).toHaveBeenCalledWith('ply-race', 'e7e5');
		expect(broadcasts.filter((b) => b.room === 'game:ply-race')).toHaveLength(0);
	});

	it('chains the house bot after the seated player moves', async () => {
		vi.useFakeTimers();
		const whitesPly = soloGame('chain', {
			state: { xfen: START_XFEN, turn: 'white' },
			sanMoves: []
		});
		loadsIn(whitesPly, whitesPly, soloGame('chain'), soloGame('chain'));
		gameService.playerColorFor.mockResolvedValue('white');
		searchMock.chooseBotMove.mockReturnValue('e7e5');
		gameService.persistMove
			.mockResolvedValueOnce({
				applied: true,
				san: 'e4',
				state: { xfen: AFTER_E4_XFEN },
				finished: null
			})
			.mockResolvedValueOnce({
				applied: true,
				san: 'e5',
				state: { xfen: START_XFEN },
				finished: null
			});

		const moved = await request(connect('user-w'), 'game:move', {
			gameId: 'chain',
			uci: 'e2e4'
		});
		expect(moved).toEqual({ ok: true });
		await flushBotTurns();

		const plies = broadcasts.filter((b) => b.room === 'game:chain' && b.event === 'game:moved');
		expect(plies.map((b) => (b.payload as { ply: number }).ply)).toEqual([1, 2]);
		expect(gameService.persistMove).toHaveBeenNthCalledWith(1, 'chain', 'e2e4');
		expect(gameService.persistMove).toHaveBeenNthCalledWith(2, 'chain', 'e7e5');
	});

	it('does not wake the bot when the player drove the empty seat themselves', async () => {
		vi.useFakeTimers();
		// Solo mode lets the lone seated player answer for the empty seat;
		// afterwards it is the human's own color on turn, so the bot idles.
		const blacksPly = soloGame('takeover');
		loadsIn(
			blacksPly,
			blacksPly,
			soloGame('takeover', { state: { xfen: START_XFEN, turn: 'white' } })
		);
		gameService.playerColorFor.mockResolvedValue('white');
		gameService.persistMove.mockResolvedValue({
			applied: true,
			san: 'e5',
			state: { xfen: START_XFEN },
			finished: null
		});

		const moved = await request(connect('user-w'), 'game:move', {
			gameId: 'takeover',
			uci: 'e7e5'
		});
		expect(moved).toEqual({ ok: true });
		await flushBotTurns();

		expect(searchMock.chooseBotMove).not.toHaveBeenCalled();
		expect(
			broadcasts.filter((b) => b.room === 'game:takeover' && b.event === 'game:moved')
		).toHaveLength(1);
	});

	it('declines draw offers against the house politely', async () => {
		vi.useFakeTimers();
		loadsIn(soloGame('house-draw'));
		gameService.playerColorFor.mockResolvedValue('white');
		const socket = connect('user-w');

		await socket.trigger('game:draw-offer', { gameId: 'house-draw' });
		expect(socket.emitted.filter((e) => e.event === 'game:draw-declined')).toHaveLength(0);
		expect(notificationsMock.notifyUser).not.toHaveBeenCalled();
		expect(broadcasts.filter((b) => b.event === 'game:draw-offered')).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(900);
		expect(socket.emitted.filter((e) => e.event === 'game:draw-declined')).toHaveLength(1);
	});
});
