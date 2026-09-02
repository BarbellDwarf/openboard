/**
 * Chinese Checkers board geometry. Shared between server engine and client
 * renderer. No server-side imports (DB, etc.) — pure data and math only.
 *
 * 121-cell star-shaped hex board with 21 rows.
 * Cell naming: row-letter (a-u for rows 0-20) + column digit (0-10).
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const BOARD_ROWS = 21;
export const ROW_LENGTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
export const TOTAL_CELLS = 121;
export const HEX_SIZE = 24;

export function rowLength(row: number): number {
	return ROW_LENGTHS[row];
}

/* ------------------------------------------------------------------ */
/*  Cell naming                                                        */
/* ------------------------------------------------------------------ */

export function cellName(row: number, col: number): string {
	return String.fromCharCode(97 + row) + String(col);
}

export function parseCellName(name: string): { row: number; col: number } {
	return { row: name.charCodeAt(0) - 97, col: Number(name[1]) };
}

export function cellIndex(row: number, col: number): number {
	let idx = 0;
	for (let r = 0; r < row; r++) idx += ROW_LENGTHS[r];
	return idx + col;
}

export function cellFromIndex(idx: number): { row: number; col: number } {
	let remaining = idx;
	for (let r = 0; r < BOARD_ROWS; r++) {
		const len = ROW_LENGTHS[r];
		if (remaining < len) return { row: r, col: remaining };
		remaining -= len;
	}
	return { row: 0, col: 0 };
}

/* ------------------------------------------------------------------ */
/*  Hex grid neighbours (flat-top, offset coordinates)                 */
/* ------------------------------------------------------------------ */

export function hexNeighbours(row: number, col: number): Array<{ row: number; col: number }> {
	const even = row % 2 === 0;
	const offsets: Array<[number, number]> = even
		? [
				[-1, -1],
				[-1, 0],
				[0, -1],
				[0, 1],
				[1, -1],
				[1, 0]
			]
		: [
				[-1, 0],
				[-1, 1],
				[0, -1],
				[0, 1],
				[1, 0],
				[1, 1]
			];

	return offsets
		.map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
		.filter((n) => n.row >= 0 && n.row < BOARD_ROWS && n.col >= 0 && n.col < rowLength(n.row));
}

/* ------------------------------------------------------------------ */
/*  Board table (built once at import time)                            */
/* ------------------------------------------------------------------ */

export interface Cell {
	name: string;
	row: number;
	col: number;
	px: number;
	py: number;
	camp: number;
}

export interface CellNeighbours {
	adjacent: number[];
	jumps: (number | null)[];
}

export const cells: Cell[] = [];
export const cellNeighbours: CellNeighbours[] = [];
export const campMembers: number[][] = [[], [], [], [], [], []];

(function buildBoard(): void {
	for (let r = 0; r < BOARD_ROWS; r++) {
		for (let c = 0; c < ROW_LENGTHS[r]; c++) {
			const q = c - (r - (r & 1)) / 2;
			const px = HEX_SIZE * (3 / 2) * q + HEX_SIZE * 10;
			const py = HEX_SIZE * (Math.sqrt(3) / 2) * r + HEX_SIZE * 2;
			cells.push({ name: cellName(r, c), row: r, col: c, px, py, camp: -1 });
		}
	}

	// Camp 0 (top): rows 0-3, all cells.
	for (let r = 0; r <= 3; r++) {
		for (let c = 0; c < ROW_LENGTHS[r]; c++) {
			const i = cellIndex(r, c);
			cells[i].camp = 0;
			campMembers[0].push(i);
		}
	}

	// Camp 1 (upper-right): rows 4-8, right-side cells.
	const camp1Ranges: Array<[number, number, number]> = [
		[4, 3, 4],
		[5, 4, 5],
		[6, 5, 6],
		[7, 6, 7],
		[8, 7, 8]
	];
	for (const [r, c1, c2] of camp1Ranges) {
		for (let c = c1; c <= c2; c++) {
			const i = cellIndex(r, c);
			cells[i].camp = 1;
			campMembers[1].push(i);
		}
	}

	// Camp 2 (lower-right): rows 11-16, right-side cells.
	const camp2Ranges: Array<[number, number, number]> = [
		[11, 8, 8],
		[12, 7, 8],
		[13, 6, 7],
		[14, 5, 6],
		[15, 4, 5],
		[16, 4, 4]
	];
	for (const [r, c1, c2] of camp2Ranges) {
		for (let c = c1; c <= c2; c++) {
			const i = cellIndex(r, c);
			cells[i].camp = 2;
			campMembers[2].push(i);
		}
	}

	// Camp 3 (bottom): rows 17-20, all cells.
	for (let r = 17; r <= 20; r++) {
		for (let c = 0; c < ROW_LENGTHS[r]; c++) {
			const i = cellIndex(r, c);
			cells[i].camp = 3;
			campMembers[3].push(i);
		}
	}

	// Camp 4 (lower-left): rows 11-16, left-side cells.
	const camp4Ranges: Array<[number, number, number]> = [
		[11, 0, 0],
		[12, 0, 1],
		[13, 0, 1],
		[14, 0, 1],
		[15, 0, 1],
		[16, 0, 0]
	];
	for (const [r, c1, c2] of camp4Ranges) {
		for (let c = c1; c <= c2; c++) {
			const i = cellIndex(r, c);
			cells[i].camp = 4;
			campMembers[4].push(i);
		}
	}

	// Camp 5 (upper-left): rows 4-8, left-side cells.
	const camp5Ranges: Array<[number, number, number]> = [
		[4, 0, 1],
		[5, 0, 1],
		[6, 0, 1],
		[7, 0, 1],
		[8, 0, 1]
	];
	for (const [r, c1, c2] of camp5Ranges) {
		for (let c = c1; c <= c2; c++) {
			const i = cellIndex(r, c);
			cells[i].camp = 5;
			campMembers[5].push(i);
		}
	}

	// Build neighbour table.
	for (let i = 0; i < TOTAL_CELLS; i++) {
		const { row, col } = cells[i];
		const neighbours = hexNeighbours(row, col);
		const adjacent = neighbours.map((n) => cellIndex(n.row, n.col));

		const even = row % 2 === 0;
		const dirOffsets: Array<[number, number]> = even
			? [
					[-1, -1],
					[-1, 0],
					[0, -1],
					[0, 1],
					[1, -1],
					[1, 0]
				]
			: [
					[-1, 0],
					[-1, 1],
					[0, -1],
					[0, 1],
					[1, 0],
					[1, 1]
				];

		const jumps: (number | null)[] = [];
		for (const [dr, dc] of dirOffsets) {
			const midR = row + dr;
			const midC = col + dc;
			const farR = row + 2 * dr;
			const farC = col + 2 * dc;
			if (
				midR >= 0 &&
				midR < BOARD_ROWS &&
				midC >= 0 &&
				midC < rowLength(midR) &&
				farR >= 0 &&
				farR < BOARD_ROWS &&
				farC >= 0 &&
				farC < rowLength(farR)
			) {
				jumps.push(cellIndex(farR, farC));
			} else {
				jumps.push(null);
			}
		}

		cellNeighbours.push({ adjacent, jumps });
	}
})();

/* ------------------------------------------------------------------ */
/*  Camp constants                                                     */
/* ------------------------------------------------------------------ */

export const WHITE_CAMP = 0;
export const BLACK_CAMP = 3;

export function targetCamp(player: 'w' | 'b'): number {
	return player === 'w' ? BLACK_CAMP : WHITE_CAMP;
}
