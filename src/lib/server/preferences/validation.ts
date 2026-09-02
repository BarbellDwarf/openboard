/**
 * Field validators shared by the preferences API.
 *
 * Kept pure and dependency-light so the API contract can be unit-tested
 * without a database or SvelteKit request context.
 */

import { VARIANTS } from '../chess/types';

/** Accepted boardFlavor values: auto-detect or one of the known variants. */
export const BOARD_FLAVORS = ['auto', ...VARIANTS] as const;

export type BoardFlavor = (typeof BOARD_FLAVORS)[number];

/**
 * Sound volume is stored as an integer percentage, 0..100, matching the UI
 * slider range and the database column default (70). NaN, infinities,
 * fractions, and non-numeric values all fail.
 */
export function isValidSoundVolume(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

export function isKnownBoardFlavor(value: unknown): value is BoardFlavor {
	return typeof value === 'string' && (BOARD_FLAVORS as readonly string[]).includes(value);
}
