import { chessgroundDests, lichessRules } from 'chessops/compat';
import { normalizeMove } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { makeSanAndPlay } from 'chessops/san';
import { defaultPosition, setupPosition } from 'chessops/variant';
import { isDrop, makeSquare, parseUci } from 'chessops';
import type { Move } from 'chessops/types';
import type { Position } from 'chessops/chess';
import type { Rules } from 'chessops/types';

import type {
	ApplyMoveResult,
	DestMap,
	EngineState,
	ResultValue,
	Termination,
	VariantId
} from './types';

/**
 * Pure rules layer over chessops. No database access here; persistence lives
 * in game-service. The server is the only authority on legality.
 */

export function isChess960(variant: VariantId): boolean {
	return variant === 'chess960';
}

function rulesFor(variant: VariantId): Rules {
	switch (variant) {
		case 'standard':
		case 'chess960':
			return 'chess';
		case 'kingofthehill':
			return lichessRules('kingOfTheHill');
		case 'threecheck':
			return lichessRules('threeCheck');
		case 'racingkings':
			return lichessRules('racingKings');
		default:
			return lichessRules(variant);
	}
}

export function loadPosition(variant: VariantId, xfen?: string): Position {
	const rules = rulesFor(variant);
	if (xfen === undefined || xfen === '') return defaultPosition(rules);
	const setup = parseFen(xfen).unwrap();
	return setupPosition(rules, setup).unwrap();
}

export function stateFromPosition(pos: Position, variant: VariantId): EngineState {
	const dests = destsFor(pos, variant);
	const state: EngineState = {
		variant,
		xfen: makeFen(pos.toSetup()),
		turn: pos.turn === 'white' ? 'white' : 'black',
		dests,
		inCheck: pos.isCheck()
	};
	if (variant === 'crazyhouse' && pos.pockets) {
		state.pockets = countPockets(pos.pockets);
	}
	if (variant === 'threecheck' && pos.remainingChecks) {
		state.checkCount = {
			white: 3 - pos.remainingChecks.white,
			black: 3 - pos.remainingChecks.black
		};
	}
	return state;
}

function destsFor(pos: Position, variant: VariantId): DestMap {
	const map = chessgroundDests(pos, { chess960: isChess960(variant) });
	const out: DestMap = {};
	for (const [from, tos] of map.entries()) out[from] = [...tos];
	if (pos.rules === 'crazyhouse' && pos.dropDests) {
		const dropSquares = [...pos.dropDests()];
		for (const [role, letter] of Object.entries(ROLE_LETTERS)) {
			if (role === 'king') continue;
			let squares = dropSquares;
			if (role === 'pawn') squares = squares.filter((sq) => sq >= 8 && sq <= 55);
			if (squares.length > 0) out[`drop:${letter}`] = squares.map(makeSquare);
		}
	}
	return out;
}

const ROLE_LETTERS: Record<string, string> = {
	pawn: 'p',
	knight: 'n',
	bishop: 'b',
	rook: 'r',
	queen: 'q',
	king: 'k'
};

function countPockets(pockets: Position['pockets']): Record<string, number> {
	const out: Record<string, number> = {};
	if (!pockets) return out;
	for (const [role, letter] of Object.entries(ROLE_LETTERS)) {
		const w = (pockets.white as unknown as Record<string, number>)[role] ?? 0;
		const b = (pockets.black as unknown as Record<string, number>)[role] ?? 0;
		if (w > 0) out[`w${letter}`] = w;
		if (b > 0) out[`b${letter}`] = b;
	}
	return out;
}

export function startPosition(variant: VariantId): EngineState {
	return stateFromPosition(loadPosition(variant), variant);
}

export function applyMove(variant: VariantId, xfen: string, uci: string): ApplyMoveResult {
	let pos: Position;
	try {
		pos = loadPosition(variant, xfen);
	} catch {
		return { ok: false, error: 'invalid-position' };
	}

	const parsed = parseUci(uci);
	if (!parsed) return { ok: false, error: 'invalid-move-format' };
	const move = normalizeMove(pos, parsed);

	if (!isLegalByName(pos, variant, move)) return { ok: false, error: 'illegal-move' };

	const san = makeSanAndPlay(pos, move);
	const finished = detectFinish(pos);

	return {
		ok: true,
		san,
		uci,
		state: stateFromPosition(pos, variant),
		finished
	};
}

function isLegalByName(pos: Position, variant: VariantId, move: Move): boolean {
	if (isDrop(move)) {
		if (pos.rules !== 'crazyhouse') return false;
		let ok = pos.dropDests().has(move.to);
		if (ok && move.role === 'pawn') ok = move.to >= 8 && move.to <= 55;
		return ok;
	}
	const from = makeSquare(move.from);
	const to = makeSquare(move.to);
	const dests = chessgroundDests(pos, { chess960: isChess960(variant) }).get(from);
	return dests !== undefined && dests.includes(to);
}

export function detectFinish(
	pos: Position
): { result: ResultValue; termination: Termination } | null {
	if (pos.isVariantEnd?.()) {
		const outcome = pos.variantOutcome();
		return { result: outcomeToResult(outcome), termination: variantTermination(pos) };
	}
	if (pos.isCheckmate()) return { result: loserIs(pos.turn), termination: 'checkmate' };
	if (pos.isStalemate()) return { result: 'draw', termination: 'stalemate' };
	if (pos.isInsufficientMaterial()) return { result: 'draw', termination: 'insufficient' };
	return null;
}

function variantTermination(pos: Position): Termination {
	switch (pos.rules) {
		case 'kingofthehill':
			return 'kingofthehill';
		case '3check':
			return 'threecheck';
		case 'atomic':
			return 'atomic-king-death';
		case 'horde':
			return 'horde-wiped';
		case 'racingkings':
			return 'racingkings-finish';
		default:
			return 'insufficient';
	}
}

function outcomeToResult(
	outcome: { winner: 'white' | 'black' | undefined } | undefined
): ResultValue {
	if (!outcome || outcome.winner === undefined) return 'draw';
	return outcome.winner;
}

function loserIs(turnToMove: 'white' | 'black'): ResultValue {
	return turnToMove === 'white' ? 'black' : 'white';
}

/** Repetition and fifty-move detection need history the position does not keep. */
export function drawByRepetition(xfenHistory: string[]): boolean {
	if (xfenHistory.length < 3) return false;
	const key = (f: string) => f.split(' ').slice(0, 4).join(' ');
	const current = key(xfenHistory[xfenHistory.length - 1]);
	let count = 0;
	for (const f of xfenHistory) if (key(f) === current) count++;
	return count >= 3;
}

export function drawByFiftyMoves(xfen: string): boolean {
	const halfmoves = Number.parseInt(xfen.split(' ')[4] ?? '0', 10);
	return halfmoves >= 100;
}
