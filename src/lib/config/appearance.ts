/**
 * Appearance registries for board customization.
 * Later tickets extend these registries with additional themes, piece sets,
 * and sound packs backed by packaged assets.
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
export const BOARD_THEMES: readonly BoardTheme[] = [{ id: 'vinyl', name: 'Vinyl' }];

/** Piece artwork sets rendered on the board. */
export const PIECE_SETS: readonly PieceSet[] = [{ id: 'cburnett', name: 'Classic' }];

/** Sound packs for move and game events. */
export const SOUND_PACKS: readonly SoundPack[] = [{ id: 'kenney', name: 'Kenney' }];
