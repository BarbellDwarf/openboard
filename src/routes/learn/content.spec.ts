import { describe, expect, it } from 'vitest';

import { VARIANTS } from '$lib/server/chess/types';

import { LEARN_VARIANT_PAGES } from './content';

describe('learn variant pages', () => {
	it('covers exactly the engine variant set, in engine order', () => {
		expect(LEARN_VARIANT_PAGES.map((page) => page.id)).toEqual([...VARIANTS]);
	});

	it('gives every variant a win condition, rules and at least three tips', () => {
		for (const page of LEARN_VARIANT_PAGES) {
			expect(page.win.length).toBeGreaterThan(0);
			expect(page.rules.length).toBeGreaterThanOrEqual(2);
			expect(page.tips.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('defines all template sections non-empty for every variant', () => {
		for (const page of LEARN_VARIANT_PAGES) {
			expect(page.name).toBeTruthy();
			expect(page.tagline).toBeTruthy();
			expect(page.blurb).toBeTruthy();
			expect(page.atAGlance.length).toBeGreaterThanOrEqual(4);
			expect(page.goal.length).toBeGreaterThanOrEqual(1);
			expect(page.setup.length).toBeGreaterThanOrEqual(1);
			expect(page.pieceMovement.length).toBeGreaterThanOrEqual(1);
			expect(page.specialRules.length).toBeGreaterThanOrEqual(1);
			expect(page.opening.length).toBeGreaterThanOrEqual(1);
			expect(page.middlegame.length).toBeGreaterThanOrEqual(1);
			expect(page.endgame.length).toBeGreaterThanOrEqual(1);
			expect(page.mistakes.length).toBeGreaterThanOrEqual(5);
			expect(page.timeAdvice.length).toBeGreaterThanOrEqual(1);
			expect(page.quickReference.length).toBeGreaterThanOrEqual(3);
		}
	});
});
