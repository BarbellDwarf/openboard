import { describe, expect, it } from 'vitest';

import { BOARD_FLAVORS, isKnownBoardFlavor, isValidSoundVolume } from './validation';

describe('isValidSoundVolume', () => {
	it('accepts integer boundaries 0 and 100', () => {
		expect(isValidSoundVolume(0)).toBe(true);
		expect(isValidSoundVolume(100)).toBe(true);
	});

	it('accepts in-range integers like the slider default', () => {
		expect(isValidSoundVolume(70)).toBe(true);
		expect(isValidSoundVolume(1)).toBe(true);
		expect(isValidSoundVolume(99)).toBe(true);
	});

	it('rejects out-of-range numbers', () => {
		expect(isValidSoundVolume(101)).toBe(false);
		expect(isValidSoundVolume(-1)).toBe(false);
	});

	it('rejects fractions', () => {
		expect(isValidSoundVolume(0.5)).toBe(false);
		expect(isValidSoundVolume(49.9)).toBe(false);
	});

	it('rejects NaN and infinities', () => {
		expect(isValidSoundVolume(Number.NaN)).toBe(false);
		expect(isValidSoundVolume(Number.POSITIVE_INFINITY)).toBe(false);
		expect(isValidSoundVolume(Number.NEGATIVE_INFINITY)).toBe(false);
	});

	it('rejects non-numbers', () => {
		expect(isValidSoundVolume('50')).toBe(false);
		expect(isValidSoundVolume(null)).toBe(false);
		expect(isValidSoundVolume(undefined)).toBe(false);
		expect(isValidSoundVolume(true)).toBe(false);
		expect(isValidSoundVolume([50])).toBe(false);
	});
});

describe('isKnownBoardFlavor', () => {
	it('accepts auto-detect and every known variant', () => {
		for (const flavor of BOARD_FLAVORS) {
			expect(isKnownBoardFlavor(flavor)).toBe(true);
		}
		expect(isKnownBoardFlavor('auto')).toBe(true);
	});

	it('rejects arbitrary strings and non-strings', () => {
		expect(isKnownBoardFlavor('bogus')).toBe(false);
		expect(isKnownBoardFlavor('')).toBe(false);
		expect(isKnownBoardFlavor(42)).toBe(false);
		expect(isKnownBoardFlavor(null)).toBe(false);
		expect(isKnownBoardFlavor(undefined)).toBe(false);
	});
});
