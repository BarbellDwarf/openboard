/**
 * Appearance registries for board customization.
 * These are the only selectable ids; the preferences API validates against
 * them so dead ids can never be persisted.
 */

export interface BoardTheme {
	id: string;
	name: string;
}

export interface PieceSet {
	id: string;
	name: string;
}

export interface SoundPack {
	id: string;
	name: string;
}

/** Board colour schemes selectable per user. */
export const BOARD_THEMES: readonly BoardTheme[] = [
	{ id: 'vinyl', name: 'Vinyl' },
	{ id: 'slate', name: 'Slate' },
	{ id: 'cherry', name: 'Cherry' },
	{ id: 'marble', name: 'Marble' },
	{ id: 'contrast', name: 'High contrast' }
];

/** Piece artwork sets rendered on the board. */
export const PIECE_SETS: readonly PieceSet[] = [
	{ id: 'cburnett', name: 'Classic' },
	{ id: 'arcane', name: 'Arcane (wizard)' },
	{ id: 'draconic', name: 'Draconic (dragon)' }
];

/** Sound packs for move and game events. */
export const SOUND_PACKS: readonly SoundPack[] = [{ id: 'openboard', name: 'OpenBoard' }];
