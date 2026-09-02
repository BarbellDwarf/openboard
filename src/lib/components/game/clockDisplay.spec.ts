import { describe, expect, it } from 'vitest';

import { drainedMs, formatClock, isFlaggedLow, LOW_TIME_MS, type ClockView } from './clockDisplay';

const view = (whiteMs: number, blackMs: number, ticking: string | null): ClockView => ({
	whiteMs,
	blackMs,
	ticking
});

describe('formatClock', () => {
	it('renders whole minutes and seconds', () => {
		expect(formatClock(65_000)).toBe('1:05');
		expect(formatClock(600_000)).toBe('10:00');
	});

	it('ceils a partial second so 0:00 means spent', () => {
		expect(formatClock(999)).toBe('0:01');
		expect(formatClock(59_999)).toBe('1:00');
		expect(formatClock(0)).toBe('0:00');
	});

	it('keeps counting minutes past an hour without rolling over', () => {
		expect(formatClock(3_725_000)).toBe('62:05');
	});
});

describe('drainedMs', () => {
	it('returns zero for a missing snapshot', () => {
		expect(drainedMs(null, 'white', 1000, 4000)).toBe(0);
	});

	it('leaves the non-ticking side standing still', () => {
		const clock = view(60_000, 30_000, 'white');
		expect(drainedMs(clock, 'black', 1000, 61_000)).toBe(30_000);
	});

	it('subtracts real time from the ticking side', () => {
		const clock = view(60_000, 30_000, 'white');
		expect(drainedMs(clock, 'white', 1000, 4000)).toBe(57_000);
	});

	it('clamps the ticking side at zero once elapsed passes the remainder', () => {
		const clock = view(3000, 30_000, 'white');
		expect(drainedMs(clock, 'white', 1000, 9000)).toBe(0);
	});

	it('returns the base figure when no time has passed since the snapshot', () => {
		const clock = view(60_000, 30_000, 'black');
		expect(drainedMs(clock, 'black', 5000, 5000)).toBe(30_000);
	});
});

describe('isFlaggedLow', () => {
	it('reads flag-red under the low-time threshold', () => {
		expect(isFlaggedLow(LOW_TIME_MS - 1, false)).toBe(true);
	});

	it('stays amber at and above the threshold', () => {
		expect(isFlaggedLow(LOW_TIME_MS, false)).toBe(false);
		expect(isFlaggedLow(300_000, false)).toBe(false);
	});

	it('forces flag-red for a flagged side regardless of the figure shown', () => {
		expect(isFlaggedLow(300_000, true)).toBe(true);
	});
});
