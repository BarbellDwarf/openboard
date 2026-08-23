import { describe, expect, it } from 'vitest';

import { flaggedColor, initialClock, remainingFor } from './clocks';
import type { TimeControl } from './types';

/**
 * Restart recovery contract: the gateway rebuilds clocks at the join instant
 * with the side to move starting from its stored balance. Downtime between
 * processes charges neither player.
 */

const blitz: TimeControl = { initialMs: 60_000, incrementMs: 5_000, daysPerMove: null };

describe('live clock resume after an outage', () => {
	it('starts the side to move from its full balance at resume time', () => {
		const resumeAtMs = 1_000_000;
		const clock = initialClock(blitz, resumeAtMs, { turn: 'white', turnStartedAtMs: resumeAtMs });
		expect(remainingFor(clock, 'white', resumeAtMs)).toBe(60_000);
		expect(remainingFor(clock, 'black', resumeAtMs)).toBe(60_000);
	});

	it('charges only time played after the resume instant', () => {
		const resumeAtMs = 1_000_000;
		const clock = initialClock(blitz, resumeAtMs, { turn: 'white', turnStartedAtMs: resumeAtMs });
		expect(remainingFor(clock, 'white', resumeAtMs + 5_000)).toBe(55_000);
		expect(remainingFor(clock, 'black', resumeAtMs + 5_000)).toBe(60_000);
	});

	it('flags the side to move only after its balance burns down post-resume', () => {
		const resumeAtMs = 1_000_000;
		const clock = initialClock(blitz, resumeAtMs, { turn: 'black', turnStartedAtMs: resumeAtMs });
		expect(flaggedColor(clock, resumeAtMs + 59_999)).toBeNull();
		expect(flaggedColor(clock, resumeAtMs + 60_000)).toBe('black');
	});
});
