/**
 * Client-side appearance preferences.
 *
 * The root layout load reads the signed-in caller's row from the same table
 * the /api/preferences endpoint serves and ships it to the client; this module
 * holds it in one shared store so every Board renders the user's saved theme
 * and pieces without per-page wiring. Anonymous visitors keep the defaults,
 * which mirror the database column defaults in schema.ts.
 */

import { writable } from 'svelte/store';

import { BOARD_THEMES, PIECE_SETS } from '$lib/config/appearance';

export interface AppearancePreferences {
	boardTheme: string;
	pieceSet: string;
	soundsEnabled: boolean;
	soundVolume: number;
	autoQueen: boolean;
}

export const DEFAULT_PREFERENCES: AppearancePreferences = {
	boardTheme: 'vinyl',
	pieceSet: 'cburnett',
	soundsEnabled: true,
	soundVolume: 70,
	autoQueen: false
};

export type StoredPreferences = Partial<Record<keyof AppearancePreferences, unknown>>;

export const preferences = writable<AppearancePreferences>({ ...DEFAULT_PREFERENCES });

const THEME_IDS = new Set(BOARD_THEMES.map((t) => t.id));
const PIECE_IDS = new Set(PIECE_SETS.map((p) => p.id));

function knownTheme(value: unknown): string | null {
	return typeof value === 'string' && THEME_IDS.has(value) ? value : null;
}

function knownPieceSet(value: unknown): string | null {
	return typeof value === 'string' && PIECE_IDS.has(value) ? value : null;
}

function storedBoolean(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
}

/** Integer percentage 0..100, matching the validator on the preferences API. */
function storedVolume(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
		? value
		: null;
}

function merge(stored: StoredPreferences | null | undefined): AppearancePreferences {
	return {
		boardTheme: knownTheme(stored?.boardTheme) ?? DEFAULT_PREFERENCES.boardTheme,
		pieceSet: knownPieceSet(stored?.pieceSet) ?? DEFAULT_PREFERENCES.pieceSet,
		soundsEnabled: storedBoolean(stored?.soundsEnabled) ?? DEFAULT_PREFERENCES.soundsEnabled,
		soundVolume: storedVolume(stored?.soundVolume) ?? DEFAULT_PREFERENCES.soundVolume,
		autoQueen: storedBoolean(stored?.autoQueen) ?? DEFAULT_PREFERENCES.autoQueen
	};
}

function samePreferences(a: AppearancePreferences, b: AppearancePreferences): boolean {
	return (
		a.boardTheme === b.boardTheme &&
		a.pieceSet === b.pieceSet &&
		a.soundsEnabled === b.soundsEnabled &&
		a.soundVolume === b.soundVolume &&
		a.autoQueen === b.autoQueen
	);
}

/**
 * Load the caller's saved row into the shared store. Pass null for anonymous
 * visitors. Layout loads rerun on the unread-badge poll every 30 seconds, so
 * identical values are skipped rather than rewritten into the store.
 */
export function hydratePreferences(stored: StoredPreferences | null | undefined): void {
	const next = merge(stored);
	preferences.update((current) => (samePreferences(current, next) ? current : next));
}

/**
 * Resolution order shared by Board's theme and piece set: an explicit prop
 * wins (the settings page preview pins its live choice), then the user's
 * stored preference, then the built-in default. Blank strings count as
 * "not provided" so a half-bound attribute can never blank out the board.
 */
export function resolvePreference(
	explicitValue: string | undefined,
	storedValue: string | undefined,
	fallback: string
): string {
	if (explicitValue != null && explicitValue !== '') return explicitValue;
	if (storedValue != null && storedValue !== '') return storedValue;
	return fallback;
}

export function resolveBoardTheme(explicitValue?: string, storedValue?: string): string {
	return resolvePreference(explicitValue, storedValue, DEFAULT_PREFERENCES.boardTheme);
}

export function resolvePieceSet(explicitValue?: string, storedValue?: string): string {
	return resolvePreference(explicitValue, storedValue, DEFAULT_PREFERENCES.pieceSet);
}
