import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server as IOServer } from 'socket.io';

/**
 * Drives the moderation handler against mocked persistence: only a live
 * database-backed admin check may close a game, and the close must finalize
 * through completeGame with the 'admin-closed' token.
 */

const gameService = vi.hoisted(() => ({
	loadGame: vi.fn(),
	completeGame: vi.fn(),
	persistMove: vi.fn(),
	createGame: vi.fn(),
	playerColorFor: vi.fn()
}));
vi.mock('$lib/server/chess/game-service', () => gameService);

const rolesMock = vi.hoisted(() => ({
	isAdminUser: vi.fn(async () => false),
	hasAdmin: vi.fn(async () => true),
	promoteToAdmin: vi.fn(async () => false),
	mayCloseGame: vi.fn(() => false),
	mayDeleteChatMessage: vi.fn(() => false)
}));
vi.mock('$lib/server/auth/roles', () => rolesMock);

vi.mock('$lib/server/db', () => ({ closePool: vi.fn(async () => {}) }));
vi.mock('$lib/server/auth/session', () => ({
	getSessionFromCookieHeader: vi.fn(async () => null)
}));
vi.mock('$lib/server/correspondence', () => ({ startSweeper: vi.fn() }));
vi.mock('$lib/server/notifications', () => ({ notifyUser: vi.fn() }));
vi.mock('$lib/server/chat', () => ({
	addMessage: vi.fn(async () => 1),
	historyFor: vi.fn(async () => [])
}));

import { injectSocketIO } from './index';

type Handler = (...args: unknown[]) => unknown;

interface Broadcast {
	room: string;
	event: string;
	payload?: unknown;
}

const broadcasts: Broadcast[] = [];

class FakeSocket {
	data: { userId?: string | null; userName?: string; userRole?: string } = {};
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

function connect(userId: string | null, userRole?: string): FakeSocket {
	const socket = new FakeSocket();
	socket.data.userId = userId;
	socket.data.userRole = userRole;
	onConnection?.(socket);
	return socket;
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

afterEach(() => {
	vi.clearAllMocks();
	rolesMock.isAdminUser.mockImplementation(async () => false);
	broadcasts.length = 0;
});

describe('game:admin-close', () => {
	it('lets an administrator finalize a running game as an admin-closed draw', async () => {
		// Stale handshake snapshot says plain user; the live DB check decides.
		rolesMock.isAdminUser.mockResolvedValue(true);
		gameService.loadGame.mockResolvedValue(liveGame('mod-target'));
		gameService.completeGame.mockResolvedValue(true);

		await connect('mod-1', 'user').trigger('game:admin-close', { gameId: 'mod-target' });

		expect(rolesMock.isAdminUser).toHaveBeenCalledWith('mod-1');
		expect(gameService.completeGame).toHaveBeenCalledWith('mod-target', 'draw', 'admin-closed');
		expect(broadcasts).toContainEqual({
			room: 'game:mod-target',
			event: 'game:over',
			payload: { result: 'draw', termination: 'admin-closed' }
		});
	});

	it('ignores non-administrators', async () => {
		rolesMock.isAdminUser.mockResolvedValue(false);

		await connect('u-1', 'user').trigger('game:admin-close', { gameId: 'any-game' });

		expect(gameService.loadGame).not.toHaveBeenCalled();
		expect(gameService.completeGame).not.toHaveBeenCalled();
		expect(broadcasts).toHaveLength(0);
	});

	it('ignores signed-out sockets', async () => {
		await connect(null).trigger('game:admin-close', { gameId: 'any-game' });

		expect(rolesMock.isAdminUser).not.toHaveBeenCalled();
		expect(gameService.completeGame).not.toHaveBeenCalled();
	});

	it('skips games that already finished', async () => {
		rolesMock.isAdminUser.mockResolvedValue(true);
		gameService.loadGame.mockResolvedValue(
			liveGame('done-game', { status: 'finished', result: 'white', termination: 'checkmate' })
		);

		await connect('mod-1', 'admin').trigger('game:admin-close', { gameId: 'done-game' });

		expect(gameService.completeGame).not.toHaveBeenCalled();
		expect(broadcasts).toHaveLength(0);
	});

	it('stays silent when finalization fails', async () => {
		rolesMock.isAdminUser.mockResolvedValue(true);
		gameService.loadGame.mockResolvedValue(liveGame('boom-game'));
		gameService.completeGame.mockRejectedValue(new Error('db down'));

		await connect('mod-1', 'admin').trigger('game:admin-close', { gameId: 'boom-game' });

		expect(gameService.completeGame).toHaveBeenCalledOnce();
		expect(broadcasts).toHaveLength(0);
	});

	it('stays silent when another path wins the atomic finish claim', async () => {
		// A racing flag sweep or mate claimed the row first; the close must
		// neither broadcast a second result nor release the room's clock.
		rolesMock.isAdminUser.mockResolvedValue(true);
		gameService.loadGame.mockResolvedValue(liveGame('race-game'));
		gameService.completeGame.mockResolvedValue(false);

		await connect('mod-1', 'admin').trigger('game:admin-close', { gameId: 'race-game' });

		expect(gameService.completeGame).toHaveBeenCalledOnce();
		expect(broadcasts).toHaveLength(0);
	});
});

describe('join ack admin flag', () => {
	it('mirrors the handshake role snapshot for client affordances', async () => {
		gameService.playerColorFor.mockResolvedValue(null);
		gameService.loadGame.mockResolvedValue(liveGame('flag-game'));

		const ack = await request(connect('mod-1', 'admin'), 'game:join', { gameId: 'flag-game' });
		expect(ack.youAreAdmin).toBe(true);

		const ackTwo = await request(connect('u-1', 'user'), 'game:join', { gameId: 'flag-game' });
		expect(ackTwo.youAreAdmin).toBe(false);
	});
});

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
