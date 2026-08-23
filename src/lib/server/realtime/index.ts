import { Server as IOServer, type Socket } from 'socket.io';

import type { Color, ResultValue } from '../chess/types';
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
import { isAdminUser } from '../auth/roles';
import { startSweeper } from '../correspondence';
import { notifyUser } from '../notifications';
import { addMessage, historyFor } from '../chat';

/** Production shutdown hook: closes the pg pool owned by $lib/server/db. */
export { closePool } from '$lib/server/db';

/**
 * Realtime gateway. One Socket.IO room per game; every state change is
 * computed server-side and broadcast to the room. The handshake authenticates
 * against the same DB sessions the app uses.
 */

let backgroundJobsStarted = false;

/** Captured by injectSocketIO so background sweeps can broadcast finishes. */
let ioRef: IOServer | null = null;

interface RoomState {
	clock?: LiveClock;
	drawOfferedBy?: Color;
	rematchVotes: Set<Color>;
	newGameId?: string;
	/** Last time any handler touched this room, for idle eviction. */
	lastTouchedAtMs: number;
}

const ROOM_IDLE_MS = 30 * 60 * 1000;

const rooms = new Map<string, RoomState>();

function roomFor(gameId: string): RoomState {
	let room = rooms.get(gameId);
	if (!room) {
		room = { rematchVotes: new Set(), lastTouchedAtMs: Date.now() };
		rooms.set(gameId, room);
	}
	room.lastTouchedAtMs = Date.now();
	return room;
}

/** Drop rooms idle past ROOM_IDLE_MS so the map cannot grow without bound. */
export function evictIdleRooms(nowMs: number = Date.now()): number {
	let removed = 0;
	for (const [gameId, room] of rooms) {
		if (room.clock) continue;
		if (nowMs - room.lastTouchedAtMs < ROOM_IDLE_MS) continue;
		rooms.delete(gameId);
		removed++;
	}
	return removed;
}

function clockView(room: RoomState, nowMs: number) {
	if (!room.clock) return null;
	return {
		whiteMs: remainingFor(room.clock, 'white', nowMs),
		blackMs: remainingFor(room.clock, 'black', nowMs),
		ticking: room.clock.ticking
	};
}

/**
 * Outcome of a flag finalization attempt. completeGame's atomic claim decides
 * between the racers; 'lost' means another path already finished the game.
 */
type FlagOutcome = 'finished' | 'lost' | 'failed';

/**
 * Finalize a flagged clock through completeGame and broadcast with the same
 * shape as every other finish. Reachable from moves, joins, and the background
 * sweep so a timed game can never sit started forever.
 */
async function finalizeFlag(gameId: string, flagged: Color): Promise<FlagOutcome> {
	const winner: ResultValue = flagged === 'white' ? 'black' : 'white';
	let claimed: boolean;
	try {
		claimed = await completeGame(gameId, winner, 'timeout');
	} catch (error) {
		console.error('[realtime] flag finalize failed:', error);
		return 'failed';
	}
	if (!claimed) return 'lost';
	// The game is over: release its clock so idle eviction can reclaim the room.
	const room = rooms.get(gameId);
	if (room) room.clock = undefined;
	ioRef?.to(`game:${gameId}`).emit('game:over', { result: winner, termination: 'timeout' });
	return 'finished';
}

/** Safety net for timed games nobody is watching: finalize every fallen flag. */
export async function sweepFlaggedRooms(nowMs: number = Date.now()): Promise<number> {
	let finalized = 0;
	for (const [gameId, room] of rooms) {
		if (!room.clock) continue;
		const flagged = flaggedColor(room.clock, nowMs);
		if (!flagged) continue;
		if ((await finalizeFlag(gameId, flagged)) === 'finished') finalized++;
	}
	return finalized;
}

export function injectSocketIO(io: IOServer): void {
	ioRef = io;
	io.use(async (socket, next) => {
		try {
			const session = await getSessionFromCookieHeader(socket.request.headers.cookie);
			socket.data.userId = session?.userId ?? null;
			if (session) {
				const { playerName } = await import('../chess/game-service');
				socket.data.userName = await playerName(session.userId);
				// The snapshot only feeds client affordances; privileged handlers
				// re-verify the role against the database at action time.
				socket.data.userRole = (await isAdminUser(session.userId)) ? 'admin' : 'user';
			}
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
				let game = await loadGame(gameId);
				if (!game) return ack?.({ ok: false });
				const room = roomFor(gameId);
				if (game.timeControl.initialMs != null && !room.clock && game.status === 'started') {
					// Restart recovery. Ticking resumes at the join instant: downtime
					// between processes charges neither player's clock.
					const nowMs = Date.now();
					const turnNow = game.state.xfen.split(' ')[1] === 'b' ? 'black' : 'white';
					room.clock = initialClock(game.timeControl, nowMs, {
						turn: turnNow,
						turnStartedAtMs: nowMs
					});
				}
				if (room.clock && game.status === 'started') {
					// Flags are evaluated lazily; a join is a read, so a clock that ran
					// out while nobody watched ends here.
					const flagged = flaggedColor(room.clock, Date.now());
					if (flagged && (await finalizeFlag(gameId, flagged)) !== 'failed') {
						game = (await loadGame(gameId)) ?? game;
					}
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
					deadline,
					// Display-only affordance flag; enforcement stays server-side.
					youAreAdmin: socket.data.userRole === 'admin'
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

				const game = await loadGame(gameId);
				if (!game || game.status !== 'started') return ack?.({ ok: false, reason: 'not-active' });

				let color = await playerColorFor(gameId, socket.data.userId);
				// Solo/bot mode: the lone seated player drives empty seats whenever
				// it is that seat's turn.
				const emptySeat = game.whiteId === null ? 'white' : game.blackId === null ? 'black' : null;
				const turnSeat = game.state.turn;
				const isSeated = game.whiteId === socket.data.userId || game.blackId === socket.data.userId;
				if (emptySeat && turnSeat === emptySeat && isSeated) {
					color = emptySeat;
				}
				if (!color) return ack?.({ ok: false, reason: 'not-a-player' });
				if (game.state.turn !== color) return ack?.({ ok: false, reason: 'not-your-turn' });

				const room = roomFor(gameId);
				const nowMs = Date.now();

				if (room.clock) {
					const flagged = flaggedColor(room.clock, nowMs);
					if (flagged) {
						const outcome = await finalizeFlag(gameId, flagged);
						if (outcome === 'failed') {
							return ack?.({ ok: false, reason: 'internal-error' });
						}
						return ack?.({ ok: false, reason: 'flag-fell' });
					}
				}

				let result;
				try {
					result = await persistMove(gameId, uci);
				} catch (error) {
					// Concurrent duplicate moves lose the unique(game_id, ply) race.
					console.error('[realtime] move persistence failed:', error);
					return ack?.({ ok: false, reason: 'rejected' });
				}
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
					// The game is over: release its clock so idle eviction can reclaim
					// the room instead of pinning it forever.
					room.clock = undefined;
					io.to(`game:${gameId}`).emit('game:over', result.finished);
				}
				ack?.({ ok: true });
			}
		);

		// Per-user, matching the HTTP chat path's limits.
		const chatTimesByUser = new Map<string, number[]>();
		socket.on(
			'game:chat-send',
			async ({ gameId, body }: { gameId: string; body: string }, ack?: (r: unknown) => void) => {
				if (!socket.data.userId || !body?.trim()) return ack?.({ ok: false });
				// Spectators are read-only: only seated players may post.
				if (!(await playerColorFor(gameId, socket.data.userId))) {
					return ack?.({ ok: false, reason: 'not-a-player' });
				}
				const now = Date.now();
				const times = (chatTimesByUser.get(socket.data.userId) ?? []).filter(
					(t) => now - t < 10_000
				);
				if (times.length >= 5) return ack?.({ ok: false, reason: 'rate-limited' });
				times.push(now);
				chatTimesByUser.set(socket.data.userId, times);
				const text = body.slice(0, 500).trim();
				const id = await addMessage(gameId, socket.data.userId, text);
				io.to(`game:${gameId}`).emit('game:chat', {
					id,
					userId: socket.data.userId,
					name: socket.data.userName ?? '',
					body: text,
					createdAt: Date.now()
				});
				ack?.({ ok: true, id });
			}
		);

		socket.on(
			'game:chat-history',
			async ({ gameId }: { gameId: string }, ack?: (r: unknown) => void) => {
				ack?.({ messages: await historyFor(gameId) });
			}
		);

		socket.on('game:resign', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			const game = await loadGame(gameId);
			if (!game || game.status !== 'started') return;
			try {
				await completeGame(gameId, color === 'white' ? 'black' : 'white', 'resignation');
			} catch (error) {
				console.error('[realtime] resignation finalize failed:', error);
				return;
			}
			const room = rooms.get(gameId);
			if (room) room.clock = undefined;
			io.to(`game:${gameId}`).emit('game:over', {
				result: color === 'white' ? 'black' : 'white',
				termination: 'resignation'
			});
		});

		// Moderation: an administrator may close any running game. It finalizes
		// as a draw so nobody farms rating from an admin action. The role check
		// hits the database live; the handshake snapshot is display-only.
		socket.on('game:admin-close', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			if (!(await isAdminUser(socket.data.userId))) return;
			const game = await loadGame(gameId);
			if (!game || game.status !== 'started') return;
			try {
				await completeGame(gameId, 'draw', 'admin-closed');
			} catch (error) {
				console.error('[realtime] admin close finalize failed:', error);
				return;
			}
			const room = rooms.get(gameId);
			if (room) room.clock = undefined;
			io.to(`game:${gameId}`).emit('game:over', { result: 'draw', termination: 'admin-closed' });
		});

		socket.on('game:draw-offer', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			roomFor(gameId).drawOfferedBy = color;
			const game = await loadGame(gameId);
			const opp = game ? (color === 'white' ? game.blackId : game.whiteId) : null;
			if (opp)
				void notifyUser(opp, 'draw-offered', {
					body: 'Your opponent offers a draw.',
					url: `/game/${gameId}`
				});
			socket.to(`game:${gameId}`).emit('game:draw-offered', { by: color });
		});

		socket.on('game:draw-accept', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			// Only the recipient of a live offer may accept it.
			const room = rooms.get(gameId);
			if (!room?.drawOfferedBy || room.drawOfferedBy === color) return;
			const game = await loadGame(gameId);
			if (!game || game.status !== 'started') return;
			room.drawOfferedBy = undefined;
			try {
				await completeGame(gameId, 'draw', 'agreement');
			} catch (error) {
				console.error('[realtime] draw finalize failed:', error);
				return;
			}
			room.clock = undefined;
			io.to(`game:${gameId}`).emit('game:over', { result: 'draw', termination: 'agreement' });
		});

		socket.on('game:draw-decline', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			if (!(await playerColorFor(gameId, socket.data.userId))) return;
			roomFor(gameId).drawOfferedBy = undefined;
			socket.to(`game:${gameId}`).emit('game:draw-declined');
		});

		socket.on('game:rematch-offer', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			const room = roomFor(gameId);
			room.rematchVotes.add(color);
			socket.to(`game:${gameId}`).emit('game:rematch-offered', { by: color });
		});

		socket.on('game:rematch-accept', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const myColor = await playerColorFor(gameId, socket.data.userId);
			if (!myColor) return;
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
				// Keep the room with newGameId set so repeat offers cannot resurrect it.
			}
		});
	});
}

/** Called by both prod server and dev plugin after io is wired. */
export function startBackgroundJobs(): void {
	if (backgroundJobsStarted) return;
	backgroundJobsStarted = true;
	startSweeper();
	const flagTimer = setInterval(() => void sweepFlaggedRooms(), 10_000);
	flagTimer.unref?.();
	const timer = setInterval(() => evictIdleRooms(), 5 * 60 * 1000);
	timer.unref?.();
}
