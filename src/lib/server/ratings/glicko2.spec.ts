import { describe, expect, it } from 'vitest';

import { isProvisional, updateRating } from './glicko2';

describe('glicko-2 against the paper worked example', () => {
	it('reproduces the official example values', () => {
		const player = { rating: 1500, deviation: 200, volatility: 0.06 };
		const result = updateRating(player, [
			{ opponent: { rating: 1400, deviation: 30, volatility: 0.06 }, score: 1 },
			{ opponent: { rating: 1550, deviation: 100, volatility: 0.06 }, score: 0 },
			{ opponent: { rating: 1700, deviation: 300, volatility: 0.06 }, score: 0 }
		]);
		expect(result.rating).toBeCloseTo(1464.06, 1);
		expect(result.deviation).toBeCloseTo(151.52, 1);
		expect(result.volatility).toBeCloseTo(0.05999, 4);
	});

	it('marks new players provisional', () => {
		expect(isProvisional(350)).toBe(true);
		expect(isProvisional(120)).toBe(false);
	});
});
