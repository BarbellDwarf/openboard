import type { VariantId } from '$lib/server/chess/types';

/**
 * Hand-authored rules content for /learn. Every claim here traces to the
 * implemented behaviour in src/lib/server/chess/engine.ts and the chessops
 * variant classes it drives. When the app diverges from classical rules,
 * the text says what the app does.
 */

export interface VariantPage {
	id: VariantId;
	name: string;
	/** Short card summary shown on the /learn index. */
	blurb: string;
	/** How the game is won or lost, exactly as the engine decides it. */
	win: string[];
	/** The special rules a newcomer needs. */
	rules: string[];
	/** Practical advice, at least three per variant. */
	tips: string[];
}

export const LEARN_VARIANT_PAGES: readonly VariantPage[] = [
	{
		id: 'standard',
		name: 'Standard',
		blurb: 'The classical game: checkmate, castling, en passant, promotion.',
		win: [
			'Checkmate wins. So does your opponent resigning, or their clock reaching zero while the game runs.',
			'Draws come out as stalemate, insufficient material, threefold repetition, the fifty-move rule, or an agreed draw.'
		],
		rules: [
			'Castling: move your king two squares toward an unmoved rook with nothing between them. It is illegal while in check, through check, or into check.',
			'En passant: a pawn that advances two squares may be captured by an enemy pawn as if it had stepped only one, on the reply move only.',
			'Promotion: a pawn reaching the last rank becomes a queen, rook, bishop or knight. The site asks you to pick before the move lands.',
			'The server declares threefold repetition and the fifty-move rule by itself; there is no claim to make. Fifty moves means 100 half-moves without a capture or a pawn move.'
		],
		tips: [
			'Castle early. A king sitting in the centre loses games on its own.',
			'Every clock preset carries an increment that lands after each completed move, so steady play keeps you alive in time trouble.',
			'Careful with repetition in a winning position: shuffling back and forth hands you a draw you did not want.'
		]
	},
	{
		id: 'chess960',
		name: 'Chess960',
		blurb: 'Standard chess rules, with castling performed on rook squares.',
		win: [
			'Everything standard wins: checkmate, resignation, flag fall, and the shared draw rules.',
			'This variant uses the same underlying ruleset as standard chess.'
		],
		rules: [
			'Castling is presented on the rooks. Your king shows destinations on its own rook squares: drag the king onto a rook and the server completes the usual king-and-rook shuffle for you.',
			'Known limitation of this build: every Chess960 game starts from the traditional starting array rather than a shuffled one. That changes how castling feels, not how it resolves.'
		],
		tips: [
			'If dragging the king onto a rook feels odd at first, play a casual bot game to rehearse castling before you rate one.',
			'Openings transfer straight from standard while this build starts from the classic array, so your usual repertoire still works.',
			'Watch the board after castling anyway: the animation moves two pieces at once, which is easy to misread in fast games.'
		]
	},
	{
		id: 'crazyhouse',
		name: 'Crazyhouse',
		blurb: 'Captured pieces switch sides and return as drops from your pocket.',
		win: [
			'Checkmate wins, along with resignation and flag fall. There is no special crazyhouse finish.',
			'Material draws are rare here: pieces recycle through pockets, so bare-board endings hardly ever happen.'
		],
		rules: [
			'Every piece you capture goes into your pocket and becomes yours, whatever colour it was.',
			'A promoted piece that gets captured returns to the pocket as a pawn again.',
			'Instead of a board move you may drop a pocket piece onto any empty square. Pawns cannot be dropped on the first or eighth rank, so a drop never promotes on arrival.',
			'A drop must answer check when you are in check, just like any other defence. Drops can give check and can deliver mate.',
			'Your pocket sits beside the board: click a piece in it, then click its landing square. Kings never enter pockets.'
		],
		tips: [
			'A dropped pawn on your seventh rank promotes next move. Pawns are worth hoarding for exactly this reason.',
			'Recaptures refill your pocket, so trades usually favour the player under attack. Counterattack instead of defending passively.',
			'Before opening a line near your king, look at the enemy pocket. An empty-looking square may hold a waiting knight.'
		]
	},
	{
		id: 'kingofthehill',
		name: 'King of the Hill',
		blurb: 'March your king onto the centre four squares to win on the spot.',
		win: [
			'Any king ending its move on d4, e4, d5 or e5 wins immediately, even deep in an endgame nobody was watching.',
			'Checkmate, resignation and flag fall decide games as usual.'
		],
		rules: [
			'The hill is d4, e4, d5 and e5. Reaching any of them with your king ends the game at once.',
			'Normal safety rules still apply, so a king may not step onto the hill into check. Escort it or clear the squares first.',
			'Kings may castle normally. The castle lands on g1, c1, g8 or c8, all safely off the hill.',
			'Insufficient material never fires in this variant. Two bare kings keep playing until one walks to the hill, resigns or flags.'
		],
		tips: [
			'Every king step toward the centre is also a threat. Advance with purpose and make the opponent react.',
			'Holding the four hill squares with pawns beats chasing material across the board.',
			'When both kings race for the centre, count tempi first. Whoever arrives with protection wins.'
		]
	},
	{
		id: 'threecheck',
		name: 'Three-check',
		blurb: 'Deliver your third check and the game is over.',
		win: [
			'The third check you deliver wins immediately. Checkmate still wins too, of course.',
			'Stalemate, insufficient material and the other shared draws work as in standard chess.'
		],
		rules: [
			'Each side counts checks it has delivered itself. Direct checks, discovered checks and double checks all count as one.',
			'The server tracks both counts inside the game state and ends the game the moment either side reaches three.',
			'Otherwise the rules are plain chess. Castling, en passant and promotion behave normally.'
		],
		tips: [
			'Banked checks are threats in themselves. Two checks down, any loose piece near your king is a loaded gun.',
			'King hunts start early in this variant. Exposing the enemy king matters more than winning pawns.',
			'Defend by removing attackers, not by blocking forever. Every blocking piece tends to fall to another check.'
		]
	},
	{
		id: 'atomic',
		name: 'Atomic',
		blurb: 'Captures explode. Guard your king or blow up theirs.',
		win: [
			'Blow up the enemy king and you win on the spot. Checkmate works as well.',
			'Losing your own king to an explosion loses the game, whoever started the chain.'
		],
		rules: [
			'Every capture detonates: the capturing piece and the captured piece vanish, and each adjacent piece is destroyed too. Pawns are immune and always survive.',
			'Explosions do not chain. Only the squares touching the captured piece are affected.',
			'Kings may never capture. The capture square destroys its own occupant, so the engine forbids the move outright.',
			'Kings may stand next to each other. Touching kings give no check in atomic.',
			'Any move whose explosion would destroy your own king is illegal, including captures right next to your king.',
			'When neither side can force a kill, atomic material tables apply: lone kings draw, and a single knight, bishop or rook against a bare king cannot mate.'
		],
		tips: [
			'Pawns are blast shields. A wall of pawns around your king shrugs off explosions that would end you otherwise.',
			'Keep your king away from capturable pieces. One enemy capture on a neighbouring square and your king is gone.',
			'Pawn storms are lethal. Pawns survive their own explosions and capture their way to the enemy king.'
		]
	},
	{
		id: 'horde',
		name: 'Horde',
		blurb: 'Thirty-six kingless pawns against one ordinary army.',
		win: [
			'The engine ends the game the moment either army runs out of pieces.',
			'White plays the horde, which has no king, so it can only lose by annihilation: Black captures all 36 pawns and wins.',
			"Black's army always keeps its king, so Black loses by checkmate, resignation or flag fall rather than by being wiped out."
		],
		rules: [
			'White fields 36 pawns: solid ranks one through four plus advanced pawns already standing on b5, c5, f5 and g5. White has no king and cannot castle.',
			'Black plays a normal army from ranks seven and eight.',
			'Horde pawns promote like any pawn once they reach the eighth rank.',
			'Stalemate is still a draw, even for the kingless side.'
		],
		tips: [
			'As Black, trade whenever the exchange thins the horde. Every captured pawn is one step closer to annihilation.',
			'As the horde, use the numbers. Push passed pawns in waves and force Black to spend tempi capturing them.',
			'Black should head for simplified positions where few horde pawns remain; the horde should avoid trades of pawn for piece and keep the board crowded.'
		]
	},
	{
		id: 'racingkings',
		name: 'Racing Kings',
		blurb: 'A pure footrace: first king to the eighth rank wins.',
		win: [
			'The first king to land on rank eight wins.',
			'If White arrives first, Black gets one reply to join it there. Black arriving on the next move draws the game; failing that, White wins at once.',
			'Black reaching rank eight first, with White not there yet, wins immediately.'
		],
		rules: [
			'Both armies line up on the first two ranks. There are no pawns, no castling and no promotion.',
			'Checks never happen. Any move that would give check, directly or discovered, is illegal, and the start position already leaves both kings safe.',
			'You slow your opponent by blocking files and squares, never by checking.'
		],
		tips: [
			'Count tempos before anything else. Races are lost by one wasted move far more often than by tactics.',
			'Step your king aside early if its own army blocks the road. A buried king cannot sprint.',
			'When the opponent is one move from rank eight, find the blocking square. A single piece parked there can save half a point.'
		]
	}
];

export function variantPageFor(id: string): VariantPage | undefined {
	return LEARN_VARIANT_PAGES.find((page) => page.id === id);
}
