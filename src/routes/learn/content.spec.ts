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
});
