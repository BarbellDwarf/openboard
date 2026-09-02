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
import { chooseBotMove } from '$lib/client/bot/search';
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
 * Shape check for a client-supplied UCI string, run before any database
 * work: it must be a non-empty string of sane length. The ceiling is far
 * above any legal move (the longest real UCI here is a draughts chain of a
 * few dozen characters) and keeps oversized payloads away from the engines.
 */
export function validMoveUci(uci: unknown): uci is string {
	return typeof uci === 'string' && uci.length > 0 && uci.length <= 100;
}

/**
 * Outcome of a flag finalization attempt. completeGame's atomic claim decides
 * between the racers; 'lost' means another path already finished the game.
 */
type FlagOutcome = 'finished' | 'lost' | 'failed';

/**
 * Finalize a flagged clock through completeGame and broadcast with the same
 * shape as every other finish. Reachable from moves, joins, and the background
 * sweep so a timed game can never sit started forever. When the caller read
 * the game before checking the clock, pass its lastMoveAtMs: the finish claim
 * is then guarded on that timestamp, so a move committing as the flag falls
 * scores the mover's result instead of a stale timeout.
 */
async function finalizeFlag(
	gameId: string,
	flagged: Color,
	read?: { lastMoveAtMs: number }
): Promise<FlagOutcome> {
	const winner: ResultValue = flagged === 'white' ? 'black' : 'white';
	let claimed: boolean;
	try {
		claimed = await completeGame(
			gameId,
			winner,
			'timeout',
			read ? { onlyIfLastMoveAt: new Date(read.lastMoveAtMs) } : undefined
		);
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

/**
 * Apply one move through the shared path: flag check, persistence, clock
 * charge, broadcast. Used by human moves and the server-side bot alike, so
 * both pay clocks and emit identical events.
 */
async function commitMove(
	gameId: string,
	uci: string,
	mover: Color
): Promise<{ ok: boolean; reason?: string }> {
	const game = await loadGame(gameId);
	if (!game || game.status !== 'started') return { ok: false, reason: 'not-active' };

	const room = roomFor(gameId);
	const nowMs = Date.now();

	if (room.clock) {
		// Guarded on the just-read lastMoveAtMs: if a move commits while we
		// finalize, the timeout claim loses and that finish path owns the broadcast.
		const flagged = flaggedColor(room.clock, nowMs);
		if (flagged) {
			const outcome = await finalizeFlag(gameId, flagged, { lastMoveAtMs: game.lastMoveAtMs });
			if (outcome === 'failed') return { ok: false, reason: 'internal-error' };
			return { ok: false, reason: 'flag-fell' };
		}
	}

	let result;
	try {
		result = await persistMove(gameId, uci);
	} catch (error) {
		// Concurrent duplicate moves lose the unique(game_id, ply) race.
		console.error('[realtime] move persistence failed:', error);
		return { ok: false, reason: 'rejected' };
	}
	if (!result.applied) return { ok: false, reason: result.reason ?? 'rejected' };

	if (room.clock) {
		room.clock = applyMoveToClock(room.clock, mover, nowMs, game.timeControl.incrementMs);
	}

	ioRef?.to(`game:${gameId}`).emit('game:moved', {
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
		ioRef?.to(`game:${gameId}`).emit('game:over', result.finished);
	}
	return { ok: true };
}

/** One pending bot turn per game; re-triggers while pending collapse into one. */
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emptySeatOf(g: { whiteId: string | null; blackId: string | null }): Color | null {
	return g.whiteId === null ? 'white' : g.blackId === null ? 'black' : null;
}

/**
 * Wake the house bot if this is a solo game and it is the empty seat's turn.
 * Safe to call from joins and moves alike: the DB row is the truth, so the
 * timer re-checks everything and server restarts self-heal on the next join.
 */
function scheduleBotTurn(gameId: string): void {
	if (botTimers.has(gameId)) return;
	const timer = setTimeout(
		() => {
			botTimers.delete(gameId);
			void playBotMove(gameId);
		},
		600 + Math.random() * 900
	);
	botTimers.set(gameId, timer);
}

async function playBotMove(gameId: string): Promise<void> {
	try {
		const game = await loadGame(gameId);
		if (!game || game.status !== 'started' || game.botLevel == null) return;
		const seat = emptySeatOf(game);
		if (!seat || game.state.turn !== seat) return;
		const uci = chooseBotMove(game.variant, game.state.xfen, game.botLevel);
		if (!uci) return;
		await commitMove(gameId, uci, seat);
	} catch (error) {
		console.error('[realtime] bot move failed:', error);
	}
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
					// out while nobody watched ends here. The guard keeps a move that
					// committed during the read from being scored as a timeout.
					const flagged = flaggedColor(room.clock, Date.now());
					if (
						flagged &&
						(await finalizeFlag(gameId, flagged, { lastMoveAtMs: game.lastMoveAtMs })) !== 'failed'
					) {
						game = (await loadGame(gameId)) ?? game;
					}
				}
				await socket.join(`game:${gameId}`);
				// Solo games wake the house bot here: it opens when the human picked
				// black, and it recovers after a server restart once anyone looks in.
				scheduleBotTurn(gameId);
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
				if (!validMoveUci(uci)) return ack?.({ ok: false, reason: 'bad-uci' });
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

				const outcome = await commitMove(gameId, uci, color);
				if (outcome.ok) scheduleBotTurn(gameId);
				ack?.(outcome);
			}
		);

		// Per-user, matching the HTTP chat path's limits.
		const chatTimesByUser = new Map<string, number[]>();
		socket.on(
			'game:chat-send',
			async ({ gameId, body }: { gameId: string; body: string }, ack?: (r: unknown) => void) => {
				if (!socket.data.userId || !body?.trim()) return ack?.({ ok: false });
				// Cap before trim, mirroring the HTTP chat path's 500-char limit:
				// a multi-kilobyte body should never reach the message store.
				if (typeof body !== 'string' || body.length > 500) return ack?.({ ok: false });
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
			let claimed: boolean;
			try {
				claimed = await completeGame(gameId, color === 'white' ? 'black' : 'white', 'resignation');
			} catch (error) {
				console.error('[realtime] resignation finalize failed:', error);
				return;
			}
			// Lost the atomic claim: a racing flag sweep or mate already finished
			// this game and owns the result broadcast. Emitting here would send a
			// second, conflicting payload into the room.
			if (!claimed) return;
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
			let claimed: boolean;
			try {
				claimed = await completeGame(gameId, 'draw', 'admin-closed');
			} catch (error) {
				console.error('[realtime] admin close finalize failed:', error);
				return;
			}
			// Lost the atomic claim: the game finished through another path, which
			// owns both the result broadcast and the clock release.
			if (!claimed) return;
			const room = rooms.get(gameId);
			if (room) room.clock = undefined;
			io.to(`game:${gameId}`).emit('game:over', { result: 'draw', termination: 'admin-closed' });
		});

		socket.on('game:draw-offer', async ({ gameId }: { gameId: string }) => {
			if (!socket.data.userId) return;
			const color = await playerColorFor(gameId, socket.data.userId);
			if (!color) return;
			const game = await loadGame(gameId);
			if (game?.botLevel != null) {
				// The house declines politely; there is no opponent to convince.
				setTimeout(() => socket.emit('game:draw-declined'), 900);
				return;
			}
			roomFor(gameId).drawOfferedBy = color;
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
			let claimed: boolean;
			try {
				claimed = await completeGame(gameId, 'draw', 'agreement');
			} catch (error) {
				console.error('[realtime] draw finalize failed:', error);
				return;
			}
			// Lost the atomic claim: the game finished through another path, which
			// owns both the result broadcast and the clock release.
			if (!claimed) return;
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
