import type { Socket } from 'socket.io-client';

/**
 * Browser-side socket singleton. Lazily connects and exposes promise-wrapped
 * game channel calls so components can await server acknowledgements.
 */

let socketPromise: Promise<import('socket.io-client').Socket> | null = null;

export function getSocket(): Promise<Socket> {
	if (!socketPromise) {
		socketPromise = import('socket.io-client').then(({ io }) => io({ withCredentials: true }));
	}
	return socketPromise;
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
	return new Promise((resolve) => {
		socket.emit(event, payload, (response: T) => resolve(response));
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
