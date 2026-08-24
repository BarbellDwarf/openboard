import type { VariantId } from '$lib/server/chess/types';

/** All supported variant ids in canonical order. */
export const VARIANT_IDS: VariantId[] = [
	'standard',
	'chess960',
	'crazyhouse',
	'kingofthehill',
	'threecheck',
	'atomic',
	'horde',
	'racingkings'
];

/** User-facing names for the variant selectors. */
export const VARIANT_LABELS: Record<VariantId, string> = {
	standard: 'Standard',
	chess960: 'Chess960',
	crazyhouse: 'Crazyhouse',
	kingofthehill: 'King of the Hill',
	threecheck: 'Three-check',
	atomic: 'Atomic',
	horde: 'Horde',
	racingkings: 'Racing Kings'
};
