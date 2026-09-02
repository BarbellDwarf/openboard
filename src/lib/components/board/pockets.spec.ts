import { describe, expect, it } from 'vitest';

import { dropUci, isDropUci, pocketCountsFor, pocketsFromXfen, splitDropDests } from './pockets';

describe('isDropUci', () => {
	it('accepts the role-at-square shape', () => {
		expect(isDropUci('Q@f5')).toBe(true);
		expect(isDropUci('p@e4')).toBe(true);
	});

	it('rejects board moves', () => {
		expect(isDropUci('e2e4')).toBe(false);
		expect(isDropUci('e7e8q')).toBe(false);
		expect(isDropUci('Q@f5extra')).toBe(false);
	});
});

describe('dropUci', () => {
	it('uppercases the role letter like the bot search does', () => {
		expect(dropUci('q', 'f5')).toBe('Q@f5');
		expect(dropUci('n', 'b1')).toBe('N@b1');
	});
});

describe('pocketsFromXfen', () => {
	it('parses the bracket group appended to the board field', () => {
		const xfen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[Qqpp] w KQkq - 0 1';
		expect(pocketsFromXfen(xfen)).toEqual({ wq: 1, bq: 1, bp: 2 });
	});

	it('handles an empty pocket group', () => {
		const xfen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1';
		expect(pocketsFromXfen(xfen)).toEqual({});
	});

	it('returns empty for standard xfen without brackets', () => {
		const xfen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		expect(pocketsFromXfen(xfen)).toEqual({});
	});

	it('ignores characters that are not pocket roles', () => {
		const xfen = '8/8/8/8/8/8/8/8[XYn] w - - 0 1';
		expect(pocketsFromXfen(xfen)).toEqual({ bn: 1 });
	});
});

describe('pocketCountsFor', () => {
	it('splits holdings by color from the explicit engine field', () => {
		const pockets = { wp: 2, wq: 1, bp: 1 };
		expect(pocketCountsFor(pockets, '', 'white')).toEqual({ p: 2, q: 1 });
		expect(pocketCountsFor(pockets, '', 'black')).toEqual({ p: 1 });
	});

	it('falls back to parsing the xfen when no field is present', () => {
		const xfen = '8/8/8/8/8/8/8/8[N] b - - 0 1';
		expect(pocketCountsFor(null, xfen, 'white')).toEqual({ n: 1 });
		expect(pocketCountsFor(null, xfen, 'black')).toEqual({});
	});

	it('prefers the explicit field over the xfen parse', () => {
		const pockets = { bq: 3 };
		const xfen = '8/8/8/8/8/8/8/8[N] b - - 0 1';
		expect(pocketCountsFor(pockets, xfen, 'black')).toEqual({ q: 3 });
	});
});

describe('splitDropDests', () => {
	it('routes drop entries out of the board dest map', () => {
		const { boardDests, dropDests } = splitDropDests({
			d2: ['d3', 'd4'],
			'drop:p': ['e4', 'd5'],
			'drop:q': ['a8']
		});
		expect(boardDests).toEqual({ d2: ['d3', 'd4'] });
		expect(dropDests).toEqual({ p: ['e4', 'd5'], q: ['a8'] });
	});

	it('passes plain dests through untouched', () => {
		const { boardDests, dropDests } = splitDropDests({ e2: ['e3', 'e4'] });
		expect(boardDests).toEqual({ e2: ['e3', 'e4'] });
		expect(dropDests).toEqual({});
	});
});
