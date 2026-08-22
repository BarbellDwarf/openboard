import { Server as IOServer, type Socket } from 'socket.io';

import type { Color } from '../chess/types';
import type { LiveClock } from '../chess/clocks';
import {
	applyMoveToClock,
	correspondenceDeadline,
	flaggedColor,
	initialClock,
	remainingFor
} from '../chess/clocks';
import {
	createGame,
	completeGame,
	loadGame,
	persistMove,
	playerColorFor
} from '../chess/game-service';
import { getSessionFromCookieHeader } from '../auth/session';

/**
 * Realtime gateway. One Socket.IO room per game; every state change is
 * computed server-side and broadcast to the room. The handshake authenticates
 * against the same DB sessions the app uses.
 */

interface RoomState {
	clock?: LiveClock;
	drawOfferedBy?: Color;
	rematchVotes: Set<Color>;
	newGameId?: string;
}

const rooms = new Map<string, RoomState>();

function roomFor(gameId: string): RoomState {
	let room = rooms.get(gameId);
	if (!room) {
		room = { rematchVotes: new Set() };
		rooms.set(gameId, room);
	}
	return room;
}

function clockView(room: RoomState, nowMs: number) {
	if (!room.clock) return null;
	return {
		whiteMs: remainingFor(room.clock, 'white', nowMs),
		blackMs: remainingFor(room.clock, 'black', nowMs),
		ticking: room.clock.ticking
	};
}

export function injectSocketIO(io: IOServer): void {
	io.use(async (socket, next) => {
		try {
			const session = await getSessionFromCookieHeader(socket.request.headers.cookie);
			socket.data.userId = session?.userId ?? null;
			next();
		} catch {
			socket.data.userId = null;
			next();
		}
	});

	io.on('connection', (socket: Socket) => {
		const moveTimes: number[] = [];

		function rateLimited(): boolean {
			const now = Date.now();
			while (moveTimes.length > 0 && now - moveTimes[0] > 10_000) moveTimes.shift();
			if (moveTimes.length >= 12) return true;
			moveTimes.push(now);
			return false;
		}

		socket.on(
			'game:join',
			async ({ gameId }: { gameId: string }, ack?: (response: unknown) => void) => {
				const game = await loadGame(gameId);
				if (!game) return ack?.({ ok: false });
				const room = roomFor(gameId);
				if (game.timeControl.initialMs != null && !room.clock && game.status === 'started') {
					// Resume from now: downtime between restarts must not drain clocks.
					room.clock = initialClock(game.timeControl, Date.now());
				}
				await socket.join(`game:${gameId}`);
				const color = socket.data.userId ? await playerColorFor(gameId, socket.data.userId) : null;
				const deadline =
					game.timeControl.daysPerMove != null
						? correspondenceDeadline(game.timeControl.daysPerMove, game.lastMoveAtMs)
						: null;
				ack?.({
					ok: true,
					game: {
						id: game.id,
						variant: game.variant,
						rated: game.rated,
						status: game.status,
						result: game.result,
						termination: game.termination,
						timeControl: game.timeControl,
						whiteId: game.whiteId,
						blackId: game.blackId,
						yourColor: color
					},
					state: game.state,
					sanMoves: game.sanMoves,
					clock: clockView(room, Date.now()),
					deadline
				});
			}
		);

		socket.on(
			'game:move',
			async (
				{ gameId, uci }: { gameId: string; uci: string },
				ack?: (response: unknown) => void
			) => {
				if (!socket.data.userId) return ack?.({ ok: false, reason: 'unauthorized' });
				if (rateLimited()) return ack?.({ ok: false, reason: 'rate-limited' });

				const color = await playerColorFor(gameId, socket.data.userId);
				if (!color) return ack?.({ ok: false, reason: 'not-a-player' });

				const game = await loadGame(gameId);
				if (!game || game.status !== 'started') return ack?.({ ok: false, reason: 'not-active' });
				if (game.state.turn !== color) return ack?.({ ok: false, reason: 'not-your-turn' });

				const room = roomFor(gameId);
				const nowMs = Date.now();

				if (room.clock) {
					const flagged = flaggedColor(room.clock, nowMs);
					if (flagged) {
						await completeGame(gameId, flagged === 'white' ? 'black' : 'white', 'timeout');
						io.to(`game:${gameId}`).emit('game:over', {
							result: flagged === 'white' ? 'black' : 'white',
							termination: 'timeout'
						});
						return ack?.({ ok: false, reason: 'flag-fell' });
					}
				}

				const result = await persistMove(gameId, uci);
				if (!result.applied) return ack?.({ ok: false, reason: result.reason ?? 'rejected' });

				if (room.clock) {
					room.clock = applyMoveToClock(room.clock, color, nowMs, game.timeControl.incrementMs);
				}

				io.to(`game:${gameId}`).emit('game:moved', {
					gameId,
					ply: game.sanMoves.length + 1,
					uci,
					san: result.san,
					state: result.state,
					clock: clockView(room, nowMs),
					deadline:
						game.timeControl.daysPerMove != null
							? correspondenceDeadline(game.timeControl.daysPerMove, nowMs)
							: null
				});

				if (result.finished) {
					io.to(`game:${gameId}`).emit('game:over', result.finished);
				}
				ack?.({ ok: true });
			}
		);

		socket.on('game:resign', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			const game = await loadGame(gameId);
			if (!game || game.status !== 'started') return;
			await completeGame(gameId, color === 'white' ? 'black' : 'white', 'resignation');
			io.to(`game:${gameId}`).emit('game:over', {
				result: color === 'white' ? 'black' : 'white',
				termination: 'resignation'
			});
		});

		socket.on('game:draw-offer', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			roomFor(gameId).drawOfferedBy = color;
			socket.to(`game:${gameId}`).emit('game:draw-offered', { by: color });
		});

		socket.on('game:draw-accept', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			const game = await loadGame(gameId);
			if (!game || game.status !== 'started') return;
			await completeGame(gameId, 'draw', 'agreement');
			io.to(`game:${gameId}`).emit('game:over', { result: 'draw', termination: 'agreement' });
		});

		socket.on('game:draw-decline', ({ gameId }: { gameId: string }) => {
			roomFor(gameId).drawOfferedBy = undefined;
			socket.to(`game:${gameId}`).emit('game:draw-declined');
		});

		socket.on('game:rematch-offer', ({ gameId, color }: { gameId: string; color: Color }) => {
			const room = roomFor(gameId);
			room.rematchVotes.add(color);
			socket.to(`game:${gameId}`).emit('game:rematch-offered', { by: color });
		});

		socket.on(
			'game:rematch-accept',
			async ({ gameId, myColor }: { gameId: string; myColor: Color }) => {
				const room = rooms.get(gameId);
				if (!room) return;
				room.rematchVotes.add(myColor);
				if (room.rematchVotes.size >= 2 && !room.newGameId) {
					const game = await loadGame(gameId);
					if (!game) return;
					const newGameId = await createGame({
						variant: game.variant,
						rated: game.rated,
						timeControl: game.timeControl,
						whiteId: game.blackId,
						blackId: game.whiteId
					});
					room.newGameId = newGameId;
					io.to(`game:${gameId}`).emit('game:rematch-ready', { gameId: newGameId });
					rooms.delete(gameId);
				}
			}
		);
	});
}
