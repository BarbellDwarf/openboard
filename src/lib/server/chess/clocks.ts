import type { Color, TimeControl } from './types';

/**
 * Server-authoritative clocks. Real-time games tick against the server clock;
 * correspondence deadlines derive from days-per-move and the last move time.
 * Flag evaluation is lazy: callers check on reads and writes.
 */

export interface LiveClock {
	whiteMs: number;
	blackMs: number;
	/** The side whose clock is consuming time right now. Null when idle. */
	ticking: Color | null;
	turnStartedAtMs: number;
}

/** Resume information for a clock interrupted mid-game (e.g. after a restart). */
export interface ClockResume {
	/** Side to move right now. */
	turn: Color;
	/** When that side's turn began, ms epoch. */
	turnStartedAtMs: number;
}

export function initialClock(tc: TimeControl, nowMs: number, resume?: ClockResume): LiveClock {
	const turn = resume?.turn ?? 'white';
	const turnStart = resume?.turnStartedAtMs ?? nowMs;
	const base = tc.initialMs ?? 0;
	const drained = Math.max(0, nowMs - turnStart);
	return {
		whiteMs: turn === 'white' ? Math.max(0, base - drained) : base,
		blackMs: turn === 'black' ? Math.max(0, base - drained) : base,
		ticking: turn,
		turnStartedAtMs: turnStart
	};
}

export function elapsedSince(clock: LiveClock, nowMs: number): number {
	if (!clock.ticking) return 0;
	return Math.max(0, nowMs - clock.turnStartedAtMs);
}

export function remainingFor(clock: LiveClock, color: Color, nowMs: number): number {
	const base = color === 'white' ? clock.whiteMs : clock.blackMs;
	if (clock.ticking === color) return Math.max(0, base - elapsedSince(clock, nowMs));
	return Math.max(0, base);
}

/** Apply a completed move: charge the mover, add increment, flip the ticker. */
export function applyMoveToClock(
	clock: LiveClock,
	mover: Color,
	nowMs: number,
	incrementMs: number | null
): LiveClock {
	const spent = elapsedSince(clock, nowMs);
	const next: LiveClock = {
		whiteMs: clock.whiteMs,
		blackMs: clock.blackMs,
		ticking: mover === 'white' ? 'black' : 'white',
		turnStartedAtMs: nowMs
	};
	if (mover === 'white') {
		next.whiteMs = Math.max(0, clock.whiteMs - spent) + (incrementMs ?? 0);
	} else {
		next.blackMs = Math.max(0, clock.blackMs - spent) + (incrementMs ?? 0);
	}
	return next;
}

export function flaggedColor(clock: LiveClock, nowMs: number): Color | null {
	if (!clock.ticking) return null;
	if (remainingFor(clock, clock.ticking, nowMs) <= 0) return clock.ticking;
	return null;
}

/** Correspondence deadline for the side to move. */
export function correspondenceDeadline(daysPerMove: number, lastMoveAtMs: number): number {
	return lastMoveAtMs + daysPerMove * 24 * 60 * 60 * 1000;
}

export function isCorrespondenceFlagged(
	daysPerMove: number,
	lastMoveAtMs: number,
	nowMs: number
): boolean {
	return nowMs > correspondenceDeadline(daysPerMove, lastMoveAtMs);
}
