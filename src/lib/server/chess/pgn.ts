import type { VariantId } from './types';

const VARIANT_HEADERS: Record<VariantId, string> = {
	standard: 'Standard',
	chess960: 'Chess960',
	crazyhouse: 'Crazyhouse',
	kingofthehill: 'King of the Hill',
	threecheck: 'Three-check',
	atomic: 'Atomic',
	horde: 'Horde',
	racingkings: 'Racing Kings',
	checkers: 'Checkers'
};

const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface PgnInput {
	variant: VariantId;
	rated: boolean;
	whiteName: string;
	blackName: string;
	sanMoves: string[];
	result: 'white' | 'black' | 'draw' | null;
	initialXfen?: string;
	timeControlDescription?: string;
}

function resultString(result: PgnInput['result']): string {
	if (result === 'white') return '1-0';
	if (result === 'black') return '0-1';
	if (result === 'draw') return '1/2-1/2';
	return '*';
}

export function buildPgn(input: PgnInput): string {
	const tags: string[] = [
		`[Event "OpenBoard ${input.rated ? 'rated' : 'casual'} game"]`,
		'[Site "OpenBoard"]',
		`[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`,
		`[White "${escapeTag(input.whiteName)}"]`,
		`[Black "${escapeTag(input.blackName)}"]`,
		`[Result "${resultString(input.result)}"]`
	];
	if (input.variant !== 'standard') tags.push(`[Variant "${VARIANT_HEADERS[input.variant]}"]`);
	if (input.timeControlDescription) tags.push(`[TimeControl "${input.timeControlDescription}"]`);
	if (input.initialXfen && input.initialXfen !== STANDARD_START) {
		tags.push('[SetUp "1"]');
		tags.push(`[FEN "${input.initialXfen}"]`);
	}

	const body: string[] = [];
	for (let i = 0; i < input.sanMoves.length; i += 2) {
		const number = i / 2 + 1;
		const white = input.sanMoves[i];
		const black = input.sanMoves[i + 1] ?? '';
		body.push(`${number}. ${white}${black ? ` ${black}` : ''}`);
	}
	return `${tags.join('\n')}\n\n${body.join(' ')} ${resultString(input.result)}\n`;
}

function escapeTag(value: string): string {
	return value.replace(/["\\]/g, '');
}

/** Tokenize a PGN movetext into SAN strings, dropping numbers and annotations. */
export function sanMovesFromMovetext(movetext: string): string[] {
	return movetext
		.trim()
		.replace(/\{[^}]*\}/g, ' ')
		.replace(/\d+\.(\.\.)?/g, ' ')
		.replace(/(1-0|0-1|1\/2-1\/2|\*)$/g, ' ')
		.split(/\s+/)
		.filter((token) => token.length > 0 && token !== '$0');
}
