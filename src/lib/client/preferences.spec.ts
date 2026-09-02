import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	DEFAULT_PREFERENCES,
	hydratePreferences,
	preferences,
	resolveBoardTheme,
	resolvePieceSet,
	resolvePreference
} from './preferences';

describe('defaults', () => {
	it('mirror the database column defaults before any hydration', () => {
		expect(get(preferences)).toEqual(DEFAULT_PREFERENCES);
		expect(DEFAULT_PREFERENCES).toEqual({
			boardTheme: 'vinyl',
			pieceSet: 'cburnett',
			soundsEnabled: true,
			soundVolume: 70,
			autoQueen: false
		});
	});
});

describe('hydratePreferences', () => {
	beforeEach(() => {
		hydratePreferences(null);
	});

	it('keeps defaults for anonymous visitors (null payload)', () => {
		hydratePreferences(null);
		expect(get(preferences)).toEqual(DEFAULT_PREFERENCES);
	});

	it('keeps defaults when nothing was saved for the user (undefined payload)', () => {
		hydratePreferences(undefined);
		expect(get(preferences)).toEqual(DEFAULT_PREFERENCES);
	});

	it('applies every stored field for a signed-in caller', () => {
		hydratePreferences({
			boardTheme: 'cherry',
			pieceSet: 'arcane',
			soundsEnabled: false,
			soundVolume: 35,
			autoQueen: true
		});
		expect(get(preferences)).toEqual({
			boardTheme: 'cherry',
			pieceSet: 'arcane',
			soundsEnabled: false,
			soundVolume: 35,
			autoQueen: true
		});
	});

	it('falls back per-field when stored values are missing or malformed', () => {
		hydratePreferences({
			boardTheme: 'not-a-theme',
			pieceSet: 42,
			soundsEnabled: 'yes',
			soundVolume: 444,
			autoQueen: null
		});
		expect(get(preferences)).toEqual(DEFAULT_PREFERENCES);
	});

	it('accepts volume boundaries 0 and 100 but rejects fractions', () => {
		hydratePreferences({ soundVolume: 0 });
		expect(get(preferences).soundVolume).toBe(0);
		hydratePreferences({ soundVolume: 100 });
		expect(get(preferences).soundVolume).toBe(100);
		hydratePreferences({ soundVolume: 55.5 });
		expect(get(preferences).soundVolume).toBe(70);
	});
});

describe('resolution precedence', () => {
	it('an explicit prop beats the stored preference', () => {
		expect(resolveBoardTheme('slate', 'cherry')).toBe('slate');
		expect(resolvePieceSet('draconic', 'arcane')).toBe('draconic');
	});

	it('the stored preference beats the default when no prop is passed', () => {
		expect(resolveBoardTheme(undefined, 'marble')).toBe('marble');
		expect(resolvePieceSet(undefined, 'arcane')).toBe('arcane');
	});

	it('falls back to the built-in defaults when neither is set', () => {
		expect(resolveBoardTheme(undefined, undefined)).toBe('vinyl');
		expect(resolvePieceSet(undefined, undefined)).toBe('cburnett');
	});

	it('treats blank strings as absent at either layer', () => {
		expect(resolveBoardTheme('', 'contrast')).toBe('contrast');
		expect(resolvePreference('', '', 'vinyl')).toBe('vinyl');
	});
});
