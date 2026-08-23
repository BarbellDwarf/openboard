import type { Socket } from 'socket.io-client';

/**
 * Browser-side socket singleton. Lazily connects and exposes promise-wrapped
 * game channel calls so components can await server acknowledgements.
 */

/** How long a game channel call waits for the server's acknowledgement. */
export const ACK_TIMEOUT_MS = 5_000;

/** Thrown when the server never answers an emitted event within ACK_TIMEOUT_MS. */
export class AckTimeoutError extends Error {
	constructor(event: string) {
		super(`No server acknowledgement for "${event}" within ${ACK_TIMEOUT_MS}ms`);
		this.name = 'AckTimeoutError';
	}
}

let socketPromise: Promise<import('socket.io-client').Socket> | null = null;

export function getSocket(): Promise<Socket> {
	if (!socketPromise) {
		socketPromise = import('socket.io-client').then(({ io }) => io({ withCredentials: true }));
	}
	return socketPromise;
}

/**
 * Emit and await the server's ack, bounded by ACK_TIMEOUT_MS so a lost
 * response surfaces as a rejection instead of hanging the caller forever.
 * Exported for tests.
 */
export function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new AckTimeoutError(event)), ACK_TIMEOUT_MS);
		socket.emit(event, payload, (response: T) => {
			clearTimeout(timer);
			resolve(response);
		});
	});
}

export interface JoinResponse {
	ok: boolean;
	game?: Record<string, unknown>;
	state?: Record<string, unknown>;
	sanMoves?: string[];
	clock?: { whiteMs: number; blackMs: number; ticking: string | null } | null;
	deadline?: number | null;
}

export const gameChannel = {
	async join(gameId: string): Promise<JoinResponse> {
		const socket = await getSocket();
		return emitAck<JoinResponse>(socket, 'game:join', { gameId });
	},
	async move(gameId: string, uci: string): Promise<{ ok: boolean; reason?: string }> {
		const socket = await getSocket();
		return emitAck(socket, 'game:move', { gameId, uci });
	},
	async resign(gameId: string): Promise<void> {
		const socket = await getSocket();
		socket.emit('game:resign', { gameId });
	},
	async offerDraw(gameId: string): Promise<void> {
		const socket = await getSocket();
		socket.emit('game:draw-offer', { gameId });
	},
	async acceptDraw(gameId: string): Promise<void> {
		const socket = await getSocket();
		socket.emit('game:draw-accept', { gameId });
	},
	async declineDraw(gameId: string): Promise<void> {
		const socket = await getSocket();
		socket.emit('game:draw-decline', { gameId });
	},
	async offerRematch(gameId: string, color: 'white' | 'black'): Promise<void> {
		const socket = await getSocket();
		socket.emit('game:rematch-offer', { gameId, color });
	},
	async acceptRematch(gameId: string, color: 'white' | 'black'): Promise<void> {
		const socket = await getSocket();
		socket.emit('game:rematch-accept', { gameId, myColor: color });
	},
	on<T = Record<string, unknown>>(
		socket: Socket,
		event: string,
		handler: (payload: T) => void
	): void {
		socket.on(event, handler);
	},
	off(socket: Socket, event: string): void {
		socket.off(event);
	}
};
