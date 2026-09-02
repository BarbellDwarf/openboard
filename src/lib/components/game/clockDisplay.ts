/**
 * Pure clock-display logic behind the twin-dial clock bar. Kept free of DOM
 * and Svelte concerns so draining, formatting, and state decisions carry
 * unit tests.
 */

export type Side = 'white' | 'black';

/**
 * Shape broadcast by the server on every join ack and `game:moved` event:
 * both remainders as of one instant, plus which side's clock is running.
 * `ticking` is null once the game is untimed or finished.
 */
export interface ClockView {
	whiteMs: number;
	blackMs: number;
	ticking: Side | string | null;
}

/** Below this remainder a dial reads flag-red, per the binding design spec. */
export const LOW_TIME_MS = 10_000;

/**
 * Remaining time for one side, drained locally between server broadcasts:
 * while the snapshot says this side's clock runs, real time since the
 * snapshot instant is subtracted, clamped at zero. The idle side stands
 * still until its turn starts.
 */
export function drainedMs(view: ClockView | null, side: Side, atMs: number, nowMs: number): number {
	if (!view) return 0;
	const base = side === 'white' ? view.whiteMs : view.blackMs;
	if (view.ticking !== side) return base;
	return Math.max(0, base - (nowMs - atMs));
}

/** mm:ss, ceiling second, so a live clock reads 0:00 only once spent. */
export function formatClock(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Flag-red state for one dial: the side's flag has fallen, or its remainder
 * sits under the low-time threshold. A flagged side loses on time outright,
 * so the flag forces the state regardless of the figure shown.
 */
export function isFlaggedLow(ms: number, flagged: boolean): boolean {
	return flagged || ms < LOW_TIME_MS;
}
