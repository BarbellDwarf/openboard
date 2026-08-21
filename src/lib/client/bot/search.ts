import { parseFen } from 'chessops/fen';
import { setupPosition } from 'chessops/variant';
import type { Position } from 'chessops/chess';

/** Material values plus light piece-square bias. */
const VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 0 };

function evaluate(pos: Position): number {
	// Static eval from the perspective of the side to move.
	let white = 0;
	for (const [, piece] of pos.board) {
		const v = VALUES[piece.role] ?? 0;
		white += piece.color === 'white' ? v : -v;
	}
	return pos.turn === 'white' ? white : -white;
}

function materialCount(pos: Position): number {
	let n = 0;
	for (const [, piece] of pos.board) {
		void piece;
		n++;
	}
	return n;
}

const MATE = 1_000_000;

function negamax(pos: Position, depth: number, alpha: number, beta: number): number {
	const outcome = pos.outcome();
	if (outcome) {
		if (outcome.winner === undefined) return 0;
		return outcome.winner === pos.turn ? MATE - depth : -(MATE - depth);
	}
	if (depth === 0) return evaluate(pos);

	let best = -Infinity;
	for (const [from, destSet] of pos.allDests().entries()) {
		for (const to of destSet) {
			const child = pos.clone();
			child.play({ from, to });
			const score = -negamax(child, depth - 1, -beta, -alpha);
			if (score > best) best = score;
			if (best > alpha) alpha = best;
			if (alpha >= beta) return best;
		}
	}
	return best === -Infinity ? 0 : best;
}

function sqName(sq: number): string {
	return String.fromCharCode(97 + (sq % 8)) + String(1 + Math.floor(sq / 8));
}

export function chooseBotMove(variant: string, xfen: string, level: number): string | null {
	const rulesMap: Record<string, Parameters<typeof setupPosition>[0]> = {
		standard: 'chess',
		chess960: 'chess',
		crazyhouse: 'crazyhouse',
		kingofthehill: 'kingofthehill',
		threecheck: '3check',
		atomic: 'atomic',
		horde: 'horde',
		racingkings: 'racingkings'
	};
	let pos: Position;
	try {
		const rules = rulesMap[variant] ?? 'chess';
		pos = xfen
			? setupPosition(rules, parseFen(xfen).unwrap()).unwrap()
			: setupPosition(rules, { turn: 'white' } as never).unwrap();
	} catch {
		return null;
	}

	const depth = [0, 1, 1, 2, 2, 3][level] ?? 2;
	const blunderChance = [0.5, 0.25, 0.12, 0.05, 0][Math.min(level, 4)] ?? 0;

	type Candidate = { from: number; to: number; score: number };
	const candidates: Candidate[] = [];
	for (const [from, destSet] of pos.allDests().entries()) {
		for (const to of destSet) {
			const child = pos.clone();
			child.play({ from, to });
			const outcome = child.outcome();
			let score: number;
			if (outcome?.winner !== undefined) {
				score = outcome.winner === pos.turn ? MATE : outcome.winner === undefined ? 0 : -MATE;
			} else {
				score = -negamax(child, depth - 1, -Infinity, Infinity);
			}
			candidates.push({ from, to, score });
		}
	}
	if (candidates.length === 0) return null;

	candidates.sort((a, b) => b.score - a.score);
	if (Math.random() < blunderChance) {
		// Play a random non-losing-ish move to keep low levels beatable.
		const pool = candidates.slice(Math.min(3, candidates.length - 1));
		const pick = pool[Math.floor(Math.random() * pool.length)];
		return sqName(pick.from) + sqName(pick.to);
	}
	const best = candidates[0];
	return sqName(best.from) + sqName(best.to);
}

void materialCount;
