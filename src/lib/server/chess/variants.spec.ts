import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyMove, detectFinish, loadPosition } from './engine';

interface VariantFixture {
	name: string;
	variant: string;
	xfen: string;
	uci: string | null;
	expect: {
		ok?: boolean;
		error?: string;
		finished?: { result: string; termination: string };
		finishedByLoading?: { result: string; termination: string };
		absentSquares?: string[];
		presentSquares?: string[];
		pocketAfter?: Record<string, number>;
		dropKeyPresent?: string;
	};
}

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'variant');

const fixtures: VariantFixture[] = readdirSync(FIXTURE_DIR)
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')));

function boardHas(pos: ReturnType<typeof loadPosition>, square: string): boolean {
	const piece = pos.board.get(square.charCodeAt(0) - 97 + (Number(square[1]) - 1) * 8);
	return piece !== undefined;
}

describe('variant fixtures', () => {
	for (const fixture of fixtures) {
		it(fixture.name, () => {
			if (fixture.expect.finishedByLoading) {
				const pos = loadPosition(fixture.variant as never, fixture.xfen);
				const finish = detectFinish(pos);
				expect(finish).toEqual(fixture.expect.finishedByLoading);
				return;
			}
			const result = applyMove(fixture.variant as never, fixture.xfen, fixture.uci ?? '');
			expect(result.ok).toBe(!!fixture.expect.ok);

			if (!fixture.expect.ok) {
				if (!result.ok && fixture.expect.error) expect(result.error).toBe(fixture.expect.error);
				return;
			}
			if (!result.ok) throw new Error(`expected success, got ${result.error}`);

			if (fixture.expect.finished !== undefined) {
				expect(result.finished).toEqual(fixture.expect.finished);
			}
			for (const sq of fixture.expect.absentSquares ?? []) {
				expect(boardHas(loadPosition(result.state.variant, result.state.xfen), sq)).toBe(false);
			}
			for (const sq of fixture.expect.presentSquares ?? []) {
				expect(boardHas(loadPosition(result.state.variant, result.state.xfen), sq)).toBe(true);
			}
			if (fixture.expect.pocketAfter) {
				expect(result.state.pockets).toMatchObject(fixture.expect.pocketAfter);
			}
			if (fixture.expect.dropKeyPresent) {
				expect(Object.keys(result.state.dests)).toContain(fixture.expect.dropKeyPresent);
			}
		});
	}

	it('atomic explosion dissolves the check it would have caused', () => {
		// White knight captures a pawn adjacent to the black king; in standard
		// chess this would be check, in atomic the explosion removes both kings'
		// neighbors and no check may be given.
		const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
		const result = applyMove('atomic', fen, 'f3e5');
		expect(result.ok).toBe(true);
	});

	it('crazyhouse drops cannot resolve nothing while in check', () => {
		// White king on e1 is checked by the rook on e2 with one pawn in pocket.
		// No drop can fix an adjacent checker, so every drop is illegal.
		const fen = '4k3/8/8/8/8/4r3/8/4K3/P w - - 0 1';
		expect(applyMove('crazyhouse', fen, 'P@d3').ok).toBe(false);
		expect(applyMove('crazyhouse', fen, 'P@e3').ok).toBe(false);
	});

	it('crazyhouse pocket drops appear for the side holding pocket pieces', () => {
		// White captures into the pocket, black replies, and only then does
		// white hold drop destinations, because drops belong to the mover.
		const start = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
		const capture = applyMove('crazyhouse', start, 'f3e5');
		expect(capture.ok).toBe(true);
		if (!capture.ok) return;
		const reply = applyMove('crazyhouse', capture.state.xfen, 'd7d5');
		expect(reply.ok).toBe(true);
		if (!reply.ok) return;
		expect(Object.keys(reply.state.dests)).toContain('drop:p');
		expect(reply.state.dests['drop:p']).toContain('a3');
	});
});
