import { describe, expect, it } from 'vitest';

import type { Termination } from '$lib/server/chess/types';
import {
	TERMINATION_LABELS,
	TERMINATION_PHRASES,
	terminationLabel,
	terminationPhrase
} from './terminations';

/** The authoritative token set from the rules engine's Termination union. */
const SERVER_TOKENS: Termination[] = [
	'checkmate',
	'stalemate',
	'resignation',
	'timeout',
	'abandoned',
	'agreement',
	'repetition',
	'fifty-moves',
	'insufficient',
	'kingofthehill',
	'threecheck',
	'atomic-king-death',
	'horde-wiped',
	'racingkings-finish',
	'no-legal-move',
	'admin-closed'
];

describe('termination copy', () => {
	it('maps every server termination token in both maps', () => {
		for (const token of SERVER_TOKENS) {
			expect(TERMINATION_LABELS[token], `label for ${token}`).toBeTruthy();
			expect(TERMINATION_PHRASES[token], `phrase for ${token}`).toBeTruthy();
		}
	});

	it('uses the server tokens that previously drifted', () => {
		expect(terminationLabel('insufficient')).toBe('Insufficient material');
		expect(terminationLabel('atomic-king-death')).toBe('King exploded');
		expect(terminationLabel('horde-wiped')).toBe('Horde destroyed');
		expect(terminationLabel('racingkings-finish')).toBe('Race finished');
		expect(terminationLabel('admin-closed')).toBe('Closed by a moderator');
		expect(terminationPhrase('insufficient')).toBe('insufficient material');
		expect(terminationPhrase('atomic-king-death')).toBe('king exploded');
		expect(terminationPhrase('horde-wiped')).toBe('horde wiped out');
		expect(terminationPhrase('racingkings-finish')).toBe('race finished');
		expect(terminationPhrase('admin-closed')).toBe('closed by a moderator');
	});

	it('renders unknown tokens as-is', () => {
		expect(terminationLabel('mysterious-token')).toBe('mysterious-token');
		expect(terminationPhrase('mysterious-token')).toBe('mysterious-token');
	});
});
