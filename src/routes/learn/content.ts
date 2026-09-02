import type { VariantId } from '$lib/server/chess/types';

/**
 * Comprehensive rules content for /learn. Every claim traces to the
 * implemented behaviour in src/lib/server/chess/engine.ts and the chessops
 * variant classes it drives. When the app diverges from classical rules,
 * the text says what the app does.
 */

export interface VariantPage {
	id: VariantId;
	name: string;
	/** One-line card summary shown on the /learn index. */
	tagline: string;
	/** Short card blurb for the learn index grid. */
	blurb: string;
	/** 4-6 bullet key facts for quick orientation. */
	atAGlance: string[];
	/** Precise win conditions exactly as engine.ts implements them. */
	goal: string[];
	/** Starting position description. */
	setup: string[];
	/** What moves normally, what changed vs standard. */
	pieceMovement: string[];
	/** Every special mechanic traced to engine behavior. */
	specialRules: string[];
	/** Variant-specific opening guidance. */
	opening: string[];
	/** Strategic ideas for the middlegame. */
	middlegame: string[];
	/** Endgame notes specific to the variant. */
	endgame: string[];
	/** 5+ common beginner mistakes with corrections. */
	mistakes: string[];
	/** How the variant plays at different time controls. */
	timeAdvice: string[];
	/** Compact summary list for fast review. */
	quickReference: string[];
	/** Legacy: mapped from goal for the [variant]/+page template. */
	win: string[];
	/** Legacy: mapped from specialRules. */
	rules: string[];
	/** Legacy: mapped from mistakes. */
	tips: string[];
}

export const LEARN_VARIANT_PAGES: readonly VariantPage[] = [
	{
		id: 'standard',
		name: 'Standard',
		tagline: 'The classical game: checkmate, castling, en passant, promotion.',
		blurb: 'The classical game: checkmate, castling, en passant, promotion.',
		atAGlance: [
			'8x8 board with the usual starting array.',
			'Pieces move and capture by standard chess rules.',
			'Checkmate ends the game. Resignation and flag fall also decide games.',
			'Draws by stalemate, insufficient material, threefold repetition, fifty-move rule, or agreement.',
			'Castling, en passant, and promotion apply.',
			'Fifty-move and threefold repetition detected automatically by the server.'
		],
		goal: [
			'Checkmate the enemy king to win. The engine declares the game over the instant a checkmate position appears on the board.',
			'Your opponent may resign at any time. A resignation ends the game immediately.',
			'If a clock reaches zero during a running game, the flagged side loses. The server owns the clock; refreshing the page does not change the result.',
			'Draws occur by stalemate, insufficient material to force mate, threefold repetition, the fifty-move rule, or a mutual agreement between both players.'
		],
		setup: [
			'Standard chess begins from the array every chess player knows: white pieces on ranks one and two, black pieces on ranks seven and eight.',
			'White pawns fill a2 through h2. Black pawns fill a7 through h7.',
			'Back rank from left to right: rook, knight, bishop, queen, king, bishop, knight, rook.',
			'White moves first.',
			'The server stores positions in X-FEN format and manages the game clock server-side.'
		],
		pieceMovement: [
			'Every piece moves as in classical chess: pawns forward one (or two from their start), knights in an L-shape, bishops diagonally, rooks along ranks and files, queens combining rook and bishop movement, king one square in any direction.',
			'Pawns capture diagonally forward. All other pieces capture on their movement squares.',
			'No piece movement changes from standard chess in this variant.'
		],
		specialRules: [
			'Castling: move your king two squares toward an unmoved rook. The rook jumps to the square the king crossed. Castling is illegal while in check, through check, or into check. The king and rook must not have moved previously in the game.',
			'En passant: when a pawn advances two squares from its starting rank and lands beside an enemy pawn, that enemy pawn may capture as if the advancing pawn had moved only one square. The capture must happen on the immediately following move.',
			'Promotion: a pawn reaching the eighth rank must promote to a queen, rook, bishop, or knight. The server prompts you to choose before the move is applied.',
			'The server declares threefold repetition automatically. It compares positions by the four-field key: piece placement, side to move, castling rights, and en passant square.',
			'The fifty-move rule fires when the halfmove clock in the position reaches 100 half-moves without a pawn move or capture. The server declares it automatically; no claim is required.'
		],
		opening: [
			'In standard chess, the opening sets the tone for the entire game. Control the centre with pawns on e4 or d4, and develop knights and bishops before moving the queen.',
			'Castle early to secure the king. Kingside castling is faster and safer in most openings; queenside castling can launch a pawn storm on the kingside in aggressive lines.',
			'Avoid moving the same piece twice in the opening unless there is a concrete tactical reason. Develop with purpose: every move should improve a piece, control a key square, or prepare castling.',
			'Common opening pitfalls: pushing the f-pawn too early, bringing the queen out before minor pieces are developed, and neglecting to castle. Each of these invites tactical punishment from an alert opponent.'
		],
		middlegame: [
			'Once pieces are developed, the middlegame revolves around imbalances: pawn structure, piece activity, king safety, and material. Identify which imbalance favours you and steer the game toward positions where that advantage matters.',
			'An isolated pawn is a weakness to attack but also a base for powerful piece placement. Decide whether to use it as a launching pad or to target it as a target.',
			'Open files belong to rooks. Place rooks on files where pawn trades have happened or are likely to happen.',
			'Before launching an attack, count defenders. A successful attack needs numerical superiority near the enemy king.'
		],
		endgame: [
			'In the endgame, the king becomes an active piece. Bring it toward the centre and use it to support passed pawns.',
			'Passed pawns must be pushed. A pawn that cannot be stopped by enemy pawns is worth more with every move it advances.',
			'Lucena and Philidor positions govern rook endgames. Learn them; they appear more often than any other endgame pattern.',
			'In king and pawn endings, opposition is the critical concept. The player who does not have to move often controls key squares.'
		],
		mistakes: [
			'Castling late. The king sits in the centre where central pawn trades open lines against it. Castle within the first ten moves.',
			'Ignoring the centre. Pawns and pieces that ignore the central squares allow the opponent to build a space advantage that suffocates your position.',
			'Taking without thinking. Every capture changes the position. Pause and verify that the recapture does not leave you worse.',
			'Leaving pieces undefended. A piece without a defender is a hanging piece. Scan your position before every move.',
			'Attacking without preparation. A premature kingside attack with undeveloped pieces gives the opponent counterplay on the other side of the board.',
			'Offering a draw in a worse position. The server records the result. Only offer when you are certain the position is objectively drawn.'
		],
		timeAdvice: [
			'Bullet and blitz reward pattern recognition and quick tactical vision. Keep your openings on autopilot and focus on not hanging pieces.',
			'Rapid gives time to think through strategic plans. Use the extra time to evaluate pawn structures and long-term piece placement.',
			'Classical allows deep calculation. Spend time on critical moments: the transition to the endgame, a kingside attack, or a complex tactical sequence.',
			'Correspondence removes time pressure entirely. Use it to study positions with an engine if you wish; the result is what matters.'
		],
		quickReference: [
			'Checkmate wins. Stalemate draws.',
			'Castle early. King safety first.',
			'Control the centre with pawns and pieces.',
			'Develop knights and bishops before the queen.',
			'Fifty-move and threefold repetition are automatic.',
			'En passant: capture on the next move only.',
			'Promote by picking a piece when the pawn reaches the last rank.'
		],
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
		tagline: 'Standard chess rules, with castling performed on rook squares.',
		blurb: 'Standard chess rules, with castling performed on rook squares.',
		atAGlance: [
			'Back rank is shuffled randomly before each game.',
			'Bishops must land on opposite-coloured squares.',
			'King must start between the two rooks.',
			'Castling works by dragging the king onto a rook square.',
			'All other chess rules apply unchanged.',
			'Every game begins from a different legal starting position.'
		],
		goal: [
			'Everything standard wins: checkmate, resignation, flag fall, and the shared draw rules.',
			'This variant uses the same underlying ruleset as standard chess. The engine maps it to the "chess" rules in chessops.',
			'Threefold repetition, fifty-move rule, stalemate, and insufficient material all function identically to standard chess.'
		],
		setup: [
			'The back rank is generated by the chess960StartFen algorithm. Two bishops are placed first: one on a dark square (b, d, f, or h), one on a light square (a, c, e, or g). The queen is placed next, then two knights. The three remaining squares are filled with rook, king, rook, with the king placed strictly between the two rooks.',
			"Black's back rank mirrors white's exactly, so the position is reproducible in X-FEN notation.",
			'Pawns occupy the second and seventh ranks as in standard chess.',
			'There are 960 possible starting arrays, hence the name. Every new game shuffles the array; no two games share the same opening.',
			'Castling rights in the starting FEN are set to "KQkq" (all four castling rights) regardless of the actual king and rook positions, because castling is reinterpreted.'
		],
		pieceMovement: [
			'All pieces move identically to standard chess: knights in L-shapes, bishops diagonally, rooks along ranks and files, queens combining both, pawns forward with diagonal captures.',
			'The only change is castling. The king always lands on c1/c8 (queenside) or g1/g8 (kingside), and the rook always lands on d1/d8 (queenside) or f1/f8 (kingside), matching standard chess destinations.',
			'The engine presents castling destinations on the rook squares. Drag the king onto a rook, and the server completes the usual king-and-rook shuffle.'
		],
		specialRules: [
			'Castling is presented on the rooks. Your king shows destinations on its own rook squares: drag the king onto a rook and the server completes the usual king-and-rook shuffle for you.',
			'After castling, the king and rook end up on the same squares as in standard chess: king on c1/g1 (or c8/g8), rook on d1/f1 (or d8/f8).',
			'The castling path must be clear of other pieces, and the king must not pass through or land in check. These rules are identical to standard chess.',
			'Castling is still illegal while in check. The king cannot castle out of check.',
			'En passant, promotion, threefold repetition, and the fifty-move rule all work exactly as in standard chess.'
		],
		opening: [
			'Chess960 openings require flexibility rather than memorisation. Study the board before your first move: where are the bishops, where is the queen, which files are open for rooks.',
			'Prioritise getting the king to safety. The castling squares are the same as in standard chess, but the path there may be blocked or exposed depending on the shuffled array.',
			'Knights are often placed awkwardly in the starting array. Develop them early to natural squares where they control the centre.',
			'If the bishops are already on good diagonals, resist the urge to move them. If they are blocked behind pawns, plan a pawn break to free them.'
		],
		middlegame: [
			'Chess960 middlegames resemble standard chess once pieces are developed, but the pawn structure may differ because the starting file assignments change.',
			'Some positions arrive with half-open files aimed at the enemy king. Exploit these lines with rooks before the opponent consolidates.',
			'Tactical patterns transfer from standard chess, but the specific motifs change. Piece coordination matters more than memorised sequences.'
		],
		endgame: [
			'Endgames in Chess960 are identical to standard chess endgames once pieces are traded down. King and pawn endings, rook endings, and minor piece endings all follow the same principles.',
			'Castling in the endgame can still matter. A late castle puts the king on a safe square and activates the rook simultaneously.'
		],
		mistakes: [
			"Forgetting how castling works. The king goes to c1/g1 (or c8/g8), not to the rook's current square. The rook ends up beside the king on d1/f1 (or d8/f8).",
			'Not checking the back rank before the first move. Some arrays leave pieces trapped behind pawns. Identify blocked pieces early.',
			'Memorising a standard opening and trying to play it. The shuffled array changes what works. React to the position, not to a memorised line.',
			'Leaving the king in the centre when castling is available. The castling squares are the same as standard; use them.',
			'Ignoring that black mirrors white. If you see a weakness in your own array, the opponent has the same one.'
		],
		timeAdvice: [
			'Bullet Chess960 demands quick board assessment. Glance at the back rank and develop the most awkward pieces first.',
			'Blitz gives enough time to evaluate each unique starting position. Do not rush the first three moves.',
			'Rapid is the best speed class for learning Chess960. You have time to explore the position without time pressure.',
			'Correspondence Chess960 lets you study the starting array at length. Use it to understand the specific weaknesses of each shuffle.'
		],
		quickReference: [
			'Back rank shuffled randomly each game.',
			'Bishops on opposite colours, king between rooks.',
			'Castling: drag king onto a rook.',
			'King lands on c1/g1, rook on d1/f1.',
			'All standard chess rules apply otherwise.',
			'Every game starts from a new position.'
		],
		win: [
			'Everything standard wins: checkmate, resignation, flag fall, and the shared draw rules.',
			'This variant uses the same underlying ruleset as standard chess.'
		],
		rules: [
			'Castling is presented on the rooks. Your king shows destinations on its own rook squares: drag the king onto a rook and the server completes the usual king-and-rook shuffle for you.',
			'Each game starts from a randomly shuffled legal back rank, so no two Chess960 games share the same opening array.'
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
		tagline: 'Captured pieces switch sides and return as drops from your pocket.',
		blurb: 'Captured pieces switch sides and return as drops from your pocket.',
		atAGlance: [
			'Starting position is identical to standard chess.',
			'Captured pieces enter your pocket and can be dropped onto empty squares.',
			'Pawns cannot be dropped on the first or eighth rank.',
			'Kings never enter pockets and cannot be dropped.',
			'Drops can give check, deliver checkmate, and must answer check.',
			'Promoted pieces captured return to the pocket as pawns.'
		],
		goal: [
			'Checkmate wins, along with resignation and flag fall. There is no special crazyhouse finish.',
			'Stalemate, insufficient material, threefold repetition, and the fifty-move rule apply as in standard chess.',
			'Material draws are rare because pieces recycle through pockets. Bare-board endings seldom occur.',
			"The engine maps crazyhouse to chessops' crazyhouse rules, handling pockets and drop destinations."
		],
		setup: [
			'The starting position is identical to standard chess: white pieces on ranks one and two, black pieces on ranks seven and eight.',
			"Both players begin with an empty pocket. As captures happen, pieces accumulate in the capturing player's pocket.",
			'The engine tracks pocket contents in the game state. Each piece type has a count: wP, wN, wB, wR, wQ for white pocket pieces, bP, bN, bB, bR, bQ for black.',
			'Kings never enter pockets. The engine forbids any capture that would place a king in a pocket.'
		],
		pieceMovement: [
			'All pieces move as in standard chess. The pocket mechanic is the sole addition.',
			'Instead of a board move, you may drop a pocket piece onto any empty square. The drop is a complete move; you cannot drop and then move another piece.',
			'Pawns cannot be dropped on the first rank or the eighth rank. A pawn dropped on the second or seventh rank promotes on the next move if it advances.',
			'Drops must answer check. If you are in check, a drop that blocks or captures the checking piece is a legal defence.',
			'Drops can give check. Dropping a knight beside the enemy king, for example, delivers immediate check.',
			'Drops can deliver checkmate. A well-placed drop can end the game instantly.'
		],
		specialRules: [
			'Every piece you capture goes into your pocket and becomes yours, regardless of its original colour.',
			'A promoted piece that gets captured returns to the pocket as a pawn again, not as the promoted piece type.',
			'Kings never enter pockets. The engine prevents any move that would result in a king being captured.',
			'Your pocket sits beside the board. Click a piece in it, then click its landing square to drop it.',
			'Pawns cannot be dropped on the first or eighth rank. This prevents instant promotion on drop.',
			'The server tracks pocket contents and shows them in the game state. Drop destinations are computed and displayed as valid moves.'
		],
		opening: [
			'Crazyhouse openings follow standard chess principles with one addition: every capture changes the pocket balance. A knight trade gives each side a knight in the pocket.',
			'Be cautious with early captures. Taking a piece with your queen gives the opponent a queen drop. The tactical danger of queen drops reshapes opening theory.',
			'Develop normally, but keep an eye on which pieces you have captured. A bishop in the pocket is a threat that can appear anywhere on the board.',
			'Pawns are the safest captures to give. A pawn drop is less dangerous than a piece drop, and you lose less material if the opponent recaptures.'
		],
		middlegame: [
			'Drops redefine the middlegame. Every empty square near the enemy king is a potential drop site for checkmate.',
			'Before making a capture, consider what piece the opponent gains. Capturing a rook gives them a rook drop, which can appear on an open file with devastating effect.',
			'Defensive drops are as important as offensive ones. A piece dropped to block a check or guard a key square can swing the position.',
			'The pocket creates a second dimension of material advantage. A player with three minor pieces in the pocket has threats that raw board material cannot match.'
		],
		endgame: [
			'Endgames in crazyhouse rarely resemble standard chess endgames. The pocket keeps the board full of material.',
			'King safety remains paramount. A single piece drop beside the enemy king can end the game even in a simplified position.',
			'Pawns in the pocket are valuable for promoting. Drop a pawn on the seventh rank and push it on the next move.'
		],
		mistakes: [
			'Capturing without checking the pocket. Taking a queen gives your opponent a queen drop. Always weigh the tactical cost.',
			'Dropping a pawn on the first or eighth rank. The engine forbids this. Drop it on the second or seventh rank instead.',
			'Forgetting that drops can give check. A piece dropped beside the enemy king is a constant threat.',
			'Promoting and then losing the promoted piece. The promoted piece returns to the pocket as a pawn, not as the promoted type.',
			'Not using drops to defend. A dropped piece can block a check, guard a square, or interpose between the enemy queen and your king.',
			'Ignoring the pocket count. Track what your opponent has in their pocket. A knight drop on f6 or c6 can appear without warning.'
		],
		timeAdvice: [
			'Bullet crazyhouse is chaotic. Focus on not hanging pieces and checking the pocket before capturing.',
			'Blitz gives enough time to consider drop tactics. Use the pocket as a second layer of planning.',
			'Rapid is ideal for learning crazyhouse. You have time to evaluate the consequences of each capture.',
			'Correspondence lets you study drop possibilities at length. The tactical complexity rewards careful analysis.'
		],
		quickReference: [
			'Captured pieces enter your pocket.',
			'Drop a pocket piece instead of moving.',
			'Pawns cannot be dropped on rank 1 or 8.',
			'Promoted pieces captured return as pawns.',
			'Drops can give check and checkmate.',
			'Kings never enter pockets.'
		],
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
		tagline: 'March your king onto the centre four squares to win on the spot.',
		blurb: 'March your king onto the centre four squares to win on the spot.',
		atAGlance: [
			'Standard starting position and piece movement.',
			'The hill is the four centre squares: d4, e4, d5, e5.',
			'Any king landing on the hill wins immediately.',
			'Kings cannot step onto the hill into check.',
			'Insufficient material never fires; two bare kings keep playing.',
			'Castling lands on g1, c1, g8, or c8, all off the hill.'
		],
		goal: [
			'Any king ending its move on d4, e4, d5, or e5 wins immediately. The engine detects this via the chessops "kingOfTheHill" variant check.',
			'Checkmate still wins. The engine checks for checkmate before checking the hill, so a checkmate delivered on the hill still counts as checkmate.',
			'Resignation and flag fall decide games as usual.',
			'Stalemate, insufficient material, threefold repetition, and the fifty-move rule apply. Insufficient material never fires in this variant; two bare kings keep playing until one reaches the hill, resigns, or flags.'
		],
		setup: [
			'The starting position is identical to standard chess.',
			'The four hill squares are d4, e4, d5, and e5. These squares are highlighted on the board.',
			'The engine maps kingofthehill to chessops\' "kingOfTheHill" rules.'
		],
		pieceMovement: [
			'All pieces move as in standard chess. The hill mechanic is the sole addition.',
			'Kings move normally, one square in any direction, including toward the hill.',
			'A king cannot move onto the hill if the destination square is attacked by an enemy piece. The standard check rules prevent this.',
			'Castling is legal as in standard chess. The king lands on c1, g1, c8, or g8, all safely off the hill.'
		],
		specialRules: [
			'The hill is d4, e4, d5, and e5. Reaching any of them with your king ends the game at once.',
			'Normal safety rules still apply. A king may not step onto the hill into check. Escort it or clear the squares first.',
			'Insufficient material never fires in this variant. Two bare kings keep playing until one walks to the hill, resigns, or flags.',
			'En passant, promotion, and castling behave identically to standard chess.',
			'The engine checks the hill condition after every move. If the king lands on a hill square and is not in check, the game ends.'
		],
		opening: [
			'Openings in King of the Hill serve two purposes: develop your pieces and clear a path for your king. The centre is both a target and a battlefield.',
			"Push d4 or e4 early to control the hill squares. Pieces posted on d4, e4, d5, or e5 block the opponent's king while supporting your own.",
			'Be wary of overextending. A king march that ignores development leaves the king exposed to checks that prevent it from reaching the hill.',
			'Knights are excellent hill controllers. A knight on e4 or d5 covers the adjacent hill squares and supports a king advance.'
		],
		middlegame: [
			'The middlegame in King of the Hill revolves around controlling the four centre squares while advancing your king safely.',
			'Piece trades that open the centre benefit the side with better king positioning. Keep lines closed if your king is far from the hill.',
			'Checks are powerful defensive tools. A check forces the king off a hill square or prevents it from reaching one.',
			'Look for discovered threats. Moving a piece to reveal an attack on a hill square can catch the opponent off guard.'
		],
		endgame: [
			'Endgames are rare in King of the Hill. The king advance usually decides the game before a true endgame arrives.',
			'If an endgame does occur, the king is already an active piece. Use it to march toward the hill while supporting passed pawns.',
			'Two kings alone cannot end the game by insufficient material. One must reach the hill, resign, or flag.'
		],
		mistakes: [
			'Walking the king into check on the hill. The engine forbids this. Clear the attacking pieces first.',
			'Ignoring development. A king march without supporting pieces leaves the king exposed to checks from all directions.',
			'Forgetting that the opponent can also march. Balance your attack with prevention: block or check the enemy king.',
			'Treating the hill as the only goal. Checkmate still wins. If the opponent neglects their king, mate can arrive before the hill.',
			'Overcommitting to the centre. The hill squares are attacked by both sides. A failed march leaves your king exposed in the centre.'
		],
		timeAdvice: [
			'Bullet King of the Hill is fast and tactical. Develop quickly and march the king when the centre opens.',
			"Blitz gives time to plan a coordinated king advance. Use the extra time to check the opponent's king position.",
			'Rapid allows deeper calculation of king routes. Map out a safe path before committing.',
			'Correspondence lets you study the position at length. The king advance requires precision; use the time.'
		],
		quickReference: [
			'Hill squares: d4, e4, d5, e5.',
			'King on the hill wins instantly.',
			'Cannot step onto the hill into check.',
			'Insufficient material never fires.',
			'Castling lands off the hill.',
			'Checkmate still wins.'
		],
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
		tagline: 'Deliver your third check and the game is over.',
		blurb: 'Deliver your third check and the game is over.',
		atAGlance: [
			'Starting position identical to standard chess.',
			'Three checks delivered by one side wins the game.',
			'The engine tracks check counts for both sides.',
			'Direct checks, discovered checks, and double checks each count as one.',
			'Checkmate still wins independently.',
			'All standard draw rules apply.'
		],
		goal: [
			'The third check you deliver wins immediately. The engine detects this via chessops\' "threeCheck" variant check and the termination name is "threecheck".',
			'Checkmate still wins too. The engine checks for checkmate before the check count.',
			'Stalemate, insufficient material, threefold repetition, and the fifty-move rule work as in standard chess.',
			'Resignation and flag fall decide games as usual.'
		],
		setup: [
			'The starting position is identical to standard chess.',
			'The engine initialises both check counts to zero. The state object carries a checkCount property with white and black fields.',
			'The engine maps threecheck to chessops\' "threeCheck" rules.',
			"Each time a move delivers check, the delivering side's count increments. The server tracks this in the position state."
		],
		pieceMovement: [
			'All pieces move as in standard chess. The check count is the sole addition.',
			'No piece movement changes. Castling, en passant, and promotion work identically.',
			'The only difference is that every check brings the checking side one step closer to victory.'
		],
		specialRules: [
			'Each side counts checks it has delivered itself. Direct checks, discovered checks, and double checks all count as one check.',
			'The server tracks both counts inside the game state and ends the game the moment either side reaches three.',
			'The check count is visible in the game interface. Both players can see how many checks each side has delivered.',
			'Otherwise the rules are plain chess. Castling, en passant, and promotion behave normally.',
			'Checkmate still wins independently of the check count. A checkmate on the third check is still a win.'
		],
		opening: [
			'Openings in Three-check favour active piece play. Develop pieces toward squares that can deliver check quickly.',
			'Knights are excellent check-delivery pieces. A knight on f6 or c6 can deliver check from a natural developing square.',
			'Be cautious with early queen sorties. A queen check counts as one check, but the queen can be chased and harassed.',
			'Discovered checks are particularly powerful. A piece moving to give discovered check from a bishop or rook delivers a check while the moving piece also threatens.'
		],
		middlegame: [
			'The middlegame in Three-check revolves around the check count. Two checks down, any loose piece near your king is a loaded gun.',
			'Expose the enemy king to deliver checks. Pawn storms and piece sacrifices that open lines toward the king are more valuable here than in standard chess.',
			'Defend by removing attackers, not by blocking forever. Every blocking piece tends to fall to another check.',
			'Two checks banked are threats in themselves. The opponent must play defensively, which limits their counterplay.'
		],
		endgame: [
			'Endgames in Three-check often involve a race to deliver the final check. King safety is paramount.',
			'A king exposed in the endgame is vulnerable to checks from the remaining pieces. Keep your king sheltered.',
			'The fifty-move rule and threefold repetition still apply. A drawn endgame remains drawn even with check counts.'
		],
		mistakes: [
			'Blocking checks instead of removing the checking piece. Blocking pieces become targets for the next check.',
			'Neglecting your king to deliver checks. An exposed king invites counter-checks that even the count.',
			'Two checks down means danger. Any loose piece near your king can be checked and the game ends.',
			'Forgetting that discovered checks count. A piece moving to reveal a check from a bishop or rook delivers a check.',
			'Offering a trade when two checks down. The opponent accepts, simplifies, and delivers the third check with fewer defenders on the board.',
			'Ignoring the check count display. The engine shows both counts; track them to know when to attack and when to defend.'
		],
		timeAdvice: [
			'Bullet Three-check is fast and tactical. Develop actively and look for quick checks.',
			'Blitz gives time to calculate check sequences. Plan two- and three-move check combinations.',
			'Rapid allows deep calculation of king attacks. Map out a route to the third check.',
			'Correspondence lets you study check delivery patterns at length. The tactical complexity rewards analysis.'
		],
		quickReference: [
			'Three checks delivered wins.',
			'Direct, discovered, and double checks each count as one.',
			'Check count is shown in the interface.',
			'Checkmate still wins independently.',
			'Defend by removing attackers, not blocking.',
			'All standard draw rules apply.'
		],
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
		tagline: 'Captures explode. Guard your king or blow up theirs.',
		blurb: 'Captures explode. Guard your king or blow up theirs.',
		atAGlance: [
			'Starting position identical to standard chess.',
			'Every capture detonates: both pieces vanish, plus all adjacent pieces.',
			'Pawns are immune to explosions.',
			'Kings may never capture.',
			'Kings may stand next to each other; adjacency gives no check.',
			'Blowing up the enemy king wins. Losing your own king loses.'
		],
		goal: [
			'Blow up the enemy king and you win on the spot. The engine detects this via chessops\' "atomic" variant check with termination "atomic-king-death".',
			'Checkmate works as well. The engine checks for checkmate and the atomic win condition.',
			'Losing your own king to an explosion loses the game, whoever started the chain.',
			'Stalemate, threefold repetition, and the fifty-move rule apply. Insufficient material uses atomic-specific tables: lone kings draw, and a single knight, bishop, or rook against a bare king cannot mate.'
		],
		setup: [
			'The starting position is identical to standard chess.',
			'The engine maps atomic to chessops\' "atomic" rules.',
			'Explosion mechanics are computed by the chessops atomic position class.'
		],
		pieceMovement: [
			'All pieces move as in standard chess. The explosion mechanic is the sole change.',
			'Captures trigger explosions: the capturing piece and the captured piece vanish, and every piece on the squares adjacent to the capture square is destroyed.',
			'Pawns are immune to explosions. A pawn adjacent to a capture survives unharmed.',
			'Kings may never capture. The capture square would destroy the capturing king, so the engine forbids the move outright.',
			'Kings may stand next to each other. Touching kings give no check in atomic.'
		],
		specialRules: [
			'Every capture detonates: the capturing piece and the captured piece vanish, and each adjacent piece is destroyed too. Pawns are immune and always survive.',
			'Explosions do not chain. Only the squares touching the captured piece are affected.',
			'Kings may never capture. The capture square destroys its own occupant, so the engine forbids the move outright.',
			'Kings may stand next to each other. Touching kings give no check in atomic.',
			'Any move whose explosion would destroy your own king is illegal, including captures right next to your king.',
			'Atomic material tables determine draws: lone kings draw, and a single knight, bishop, or rook against a bare king cannot mate.'
		],
		opening: [
			'Atomic openings diverge from standard chess because captures carry explosive consequences. The centre is a minefield.',
			'Pawns are your blast shields. They survive explosions and control key squares without risking piece losses.',
			'Develop knights to squares where they control the centre but stay away from capture hotspots. A knight on a square adjacent to many occupied squares is vulnerable.',
			'Very early queen moves are risky. The queen is a high-value piece that can be blown up if it lands near enemy pieces.'
		],
		middlegame: [
			'Atomic middlegames are tactical minefields. Every capture reshapes the board dramatically.',
			'Pawn storms are lethal. Pawns survive their own explosions and capture their way to the enemy king. A pawn chain advancing toward the king is a slow-motion explosion.',
			'Keep your king away from capturable pieces. One enemy capture on a neighbouring square and your king is gone.',
			'Sacrifices carry extra weight. A piece sacrifice that lures the enemy king into a cluster of pieces can set up a winning explosion.'
		],
		endgame: [
			'Atomic endgames are rare because explosions simplify the board quickly.',
			'When endgames do occur, pawn endings dominate. Pawns survive explosions and can promote.',
			'A lone king against a lone king is a draw. Insufficient material tables in the engine handle these cases.',
			'A single knight, bishop, or rook against a bare king cannot deliver checkmate by atomic rules. The game is drawn.'
		],
		mistakes: [
			'Capturing next to your own king. The explosion destroys your king and you lose. Check adjacent pieces before capturing.',
			'Forgetting that kings can stand next to each other. Adjacency gives no check in atomic. A king beside the enemy king is safe.',
			'Leaving pieces clustered near each other. One explosion wipes out multiple pieces. Spread your forces.',
			'Capturing with a piece adjacent to your king. The explosion kills both the captured piece and your king.',
			'Ignoring pawn immunity. Pawns survive explosions. Use them as shields and as attackers.',
			'Playing standard chess tactics without accounting for explosions. A fork that works in standard may lose a piece to an explosion in atomic.'
		],
		timeAdvice: [
			'Bullet atomic is chaotic. Focus on not blowing up your own king and watching for opponent explosions.',
			'Blitz gives time to calculate explosion radius. Count the pieces adjacent to any capture square.',
			'Rapid allows deep calculation of explosion chains. Map out the consequences before capturing.',
			'Correspondence lets you study explosion patterns at length. The tactical complexity rewards careful analysis.'
		],
		quickReference: [
			'Captures explode: both pieces plus adjacent pieces vanish.',
			'Pawns survive explosions.',
			'Kings never capture.',
			'Kings can stand next to each other.',
			'Blow up the enemy king to win.',
			'Explosions do not chain.'
		],
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
		tagline: 'Thirty-six kingless pawns against one ordinary army.',
		blurb: 'Thirty-six kingless pawns against one ordinary army.',
		atAGlance: [
			'White plays 36 pawns with no king.',
			'Black plays a normal army from ranks seven and eight.',
			'White wins by checkmating the black king.',
			'Black wins by capturing all 36 horde pawns.',
			'Horde pawns promote normally on the eighth rank.',
			'Stalemate is a draw, even for the kingless side.'
		],
		goal: [
			'The engine ends the game the moment either army runs out of pieces. This is the "horde-wiped" termination.',
			'White plays the horde, which has no king, so it can only lose by annihilation: Black captures all 36 pawns and wins.',
			"Black's army always keeps its king, so Black loses by checkmate, resignation, or flag fall rather than by being wiped out.",
			'Stalemate is a draw, even for the kingless side. The engine recognises stalemate regardless of whether a king is present.',
			'Threefold repetition and the fifty-move rule apply.'
		],
		setup: [
			'White plays the horde: solid ranks one through four are filled with pawns (32 pawns on a1-d1, a2-d2, a3-d3, a4-d4, e1-h1, e2-h2, e3-h3, e4-h4). Additionally, four advanced pawns stand on b5, c5, f5, and g5. That makes 36 pawns total.',
			'White has no king. White cannot castle.',
			'Black plays a normal army from ranks seven and eight: pawns on a7-h7, and the usual back-rank pieces.',
			'The engine maps horde to chessops\' "horde" rules.'
		],
		pieceMovement: [
			'Horde pawns move and capture like standard pawns: forward one square, or two from their starting position, capturing diagonally.',
			'Horde pawns promote normally on the eighth rank. The server prompts you to choose a piece.',
			"Black's pieces move as in standard chess. All normal piece rules apply.",
			"White has no king, so White cannot be in check. White's moves are never restricted by check or checkmate."
		],
		specialRules: [
			'White has no king and cannot castle. There is no king to check or checkmate.',
			'Black always has a king. Black can be checkmated, can resign, and can flag.',
			'Horde pawns promote like any pawn once they reach the eighth rank.',
			'Stalemate is still a draw, even for the kingless side.',
			"The game ends when one army is wiped out: all 36 horde pawns captured (Black wins) or Black's king is checkmated (White wins)."
		],
		opening: [
			'As Black, your opening goal is to trade pieces for pawns. Every captured pawn thins the horde and brings you closer to annihilation.',
			'As the horde, your opening goal is to advance pawns in coordinated waves. Push passed pawns and force Black to spend tempi capturing them.',
			'Black should avoid passive defence. Active piece play that captures horde pawns is the path to victory.',
			'The horde should avoid trades of pawn for piece. Each horde pawn is a unit in a 36-pawn army; losing them without compensation weakens the horde.'
		],
		middlegame: [
			'As Black, trade whenever the exchange thins the horde. Every captured pawn is one step closer to annihilation.',
			'As the horde, use the numbers. Push passed pawns in waves and force Black to spend tempi capturing them.',
			'Black should head for simplified positions where few horde pawns remain. The horde should avoid trades and keep the board crowded.',
			'Horde pawns can promote. A promoted piece in the horde adds firepower that Black must respect.',
			"Black's pieces are more mobile than individual pawns. Use piece coordination to target clusters of horde pawns."
		],
		endgame: [
			'In the endgame, the number of remaining horde pawns determines the result. Fewer pawns favour Black.',
			'A single horde pawn against a full Black army is a losing position for the horde. The pawn will be captured.',
			'Promoted horde pieces can swing the endgame. A horde queen or rook changes the material balance dramatically.',
			"Black's king remains a target throughout. Even in a simplified position, checkmate is possible."
		],
		mistakes: [
			'Passive defence as Black. Sitting behind your pieces while the horde advances gives the horde time to promote.',
			'Trading pieces for pawns without a plan. Random trades leave Black with insufficient material to stop the horde.',
			'As the horde, pushing pawns without coordination. Isolated pawns are easy targets. Push in waves.',
			'As Black, ignoring promoted horde pieces. A promoted queen or rook changes the game instantly.',
			'As the horde, allowing piece trades. Each trade thins the horde and brings annihilation closer.',
			'Forgetting that the horde has no king. You cannot check or checkmate White. Your only path to victory is annihilation.'
		],
		timeAdvice: [
			'Bullet Horde is fast and chaotic. As Black, capture pawns quickly. As the horde, push waves.',
			'Blitz gives time to calculate pawn promotion paths. Use the extra time to plan coordinated advances.',
			"Rapid allows strategic planning of horde waves and Black's defensive structure.",
			'Correspondence lets you study the position at length. The asymmetric nature rewards careful analysis.'
		],
		quickReference: [
			'White: 36 pawns, no king.',
			'Black: normal army with king.',
			'White wins by checkmate.',
			'Black wins by capturing all 36 pawns.',
			'Horde pawns promote normally.',
			'Stalemate draws, even without a king.'
		],
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
		tagline: 'A pure footrace: first king to the eighth rank wins.',
		blurb: 'A pure footrace: first king to the eighth rank wins.',
		atAGlance: [
			'No pawns on the board.',
			'Both armies line up on the first two ranks.',
			'First king to reach rank eight wins.',
			'If White arrives first, Black gets one reply.',
			'Checks never happen; checking moves are illegal.',
			'No castling and no promotion.'
		],
		goal: [
			'The first king to land on rank eight wins. The engine detects this via chessops\' "racingKings" variant check with termination "racingkings-finish".',
			'If White arrives first on rank eight, Black gets one reply to join it there. Black arriving on the next move draws the game; failing that, White wins at once.',
			'Black reaching rank eight first, with White not there yet, wins immediately.',
			'Resignation and flag fall decide games as usual.'
		],
		setup: [
			'Both armies line up on the first two ranks. White: pieces on a1, b1, c1, d1, e1, f1, g1, h1 and a2, b2, c2, d2, e2, f2, g2, h2.',
			'Black mirrors: pieces on a8, b8, c8, d8, e8, f8, g8, h8 and a7, b7, c7, d7, e7, f7, g7, h7.',
			'White has a rook and king on d1 and e1 (the kings) and the rest are rooks, bishops, and knights. Specifically: rook, knight, bishop, queen, king, bishop, knight, rook on rank one, and the same on rank two (but actually rooks on both ranks).',
			'No pawns are present on the board.',
			'The engine maps racingkings to chessops\' "racingKings" rules.'
		],
		pieceMovement: [
			'Rooks, bishops, knights, queens, and kings move as in standard chess.',
			'There are no pawns, no castling, and no promotion.',
			'Any move that would give check, directly or discovered, is illegal. The start position already leaves both kings safe.',
			'You slow your opponent by blocking files and squares, never by checking.'
		],
		specialRules: [
			'Checks never happen. Any move that would give check, directly or discovered, is illegal. The start position already leaves both kings safe.',
			'No castling. The kings are already in the centre of the back rank.',
			'No promotion. There are no pawns to promote.',
			'If White reaches rank eight first, Black gets exactly one reply. If Black also reaches rank eight on that reply, the game is drawn. If Black does not, White wins.',
			'Black reaching rank eight first, with White not there yet, wins immediately.'
		],
		opening: [
			"In Racing Kings, the opening is the race. Every move must either advance your king or block the opponent's king.",
			'Count tempos before anything else. Races are lost by one wasted move far more often than by tactics.',
			'Step your king aside early if its own army blocks the road. A buried king cannot sprint.',
			"Knights are excellent blockers. A knight parked on a key square can halt the opponent's king advance while your king moves forward."
		],
		middlegame: [
			'The middlegame in Racing Kings is a continuation of the race. Piece coordination matters more than material.',
			'When the opponent is one move from rank eight, find the blocking square. A single piece parked there can save half a point.',
			"Look for discovered checks. A piece moving to reveal a check from a bishop or rook can block the opponent's king while advancing your own.",
			"Trade pieces only if the trade helps your king advance or blocks the opponent's king."
		],
		endgame: [
			'Endgames in Racing Kings involve fewer pieces but the same race. Every move must advance or block.',
			'A king on rank seven is one move from victory. The opponent must block or race faster.',
			'The draw rule for White arriving first gives Black a chance. Use it to secure half a point when you cannot win.'
		],
		mistakes: [
			"Wasting a move on material when the opponent's king is racing. Material is irrelevant; speed is everything.",
			'Forgetting the draw rule. If White reaches rank eight first and Black joins on the next move, it is a draw.',
			"Not checking your king's path. A blocked king wastes moves trying to go around.",
			"Blocking the wrong square. Identify which square stops the opponent's king most effectively.",
			"Pushing pieces forward without a plan. Every move must either advance your king or block the opponent's king."
		],
		timeAdvice: [
			'Bullet Racing Kings is pure speed. Move fast and block instinctively.',
			'Blitz gives time to calculate blocking squares. Use the extra time to find the best blocker.',
			'Rapid allows strategic planning of king routes. Map out the fastest path and the best blocking squares.',
			'Correspondence lets you study the position at length. The race requires precision; use the time.'
		],
		quickReference: [
			'No pawns, no castling, no promotion.',
			'First king to rank eight wins.',
			'White arrives first: Black gets one reply.',
			'Checks are illegal.',
			'Block to slow the opponent.',
			'Count tempos before anything else.'
		],
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
	},
	{
		id: 'checkers',
		name: 'Checkers',
		tagline: 'American draughts: mandatory jumps, multi-jumps, and kings on the last rank.',
		blurb: 'American draughts: mandatory jumps, multi-jumps, and kings on the last rank.',
		atAGlance: [
			'8x8 board with 12 pieces per side on dark squares.',
			'Men move diagonally forward one square; captures are diagonal jumps.',
			'Captures are mandatory. Multi-jump chains continue while available.',
			'Kings crown on reaching the last rank and move one square diagonally in all directions.',
			'Win when the opponent has no pieces or no legal moves.',
			'No draws by repetition or fifty-move rule.'
		],
		goal: [
			'Capture all opponent pieces or leave them with no legal move. The engine ends the game the instant either condition appears.',
			'Resignation and flag fall decide games as usual.',
			'There are no draws by repetition, insufficient material, or fifty-move rule in this variant.'
		],
		setup: [
			'The board is 8x8 with pieces placed only on dark squares.',
			'Each side starts with 12 men on the three rows closest to them.',
			'White occupies the dark squares of ranks 1 through 3. Black occupies the dark squares of ranks 6 through 8.',
			'White moves first.',
			'The engine stores positions in standard FEN notation with P/p for men and K/k for kings.'
		],
		pieceMovement: [
			'Men move diagonally forward one square to an empty dark square. White men move toward rank 8; black men move toward rank 1.',
			'Kings move diagonally one square in any direction (forward or backward) to an empty dark square.',
			'Captures are diagonal jumps over an adjacent enemy piece to the empty square immediately beyond it.',
			'Men can only jump forward. Kings can jump in all four diagonal directions.'
		],
		specialRules: [
			'Captures are mandatory. If a capture is available you must make it. You cannot choose a non-capture move when a capture exists.',
			'Multi-jump chains: after a jump, if the same piece can jump again from its new position it must continue jumping. The chain ends when no further jumps are available.',
			'No maximum-capture rule: the engine does not require you to take the longest chain. Any legal capture chain is accepted.',
			'Kings crown automatically when a man reaches the opposite back rank. No player choice is involved.',
			'The game ends when one side has no pieces remaining or no legal move available. The opponent wins.'
		],
		opening: [
			'In checkers the opening revolves around controlling the centre four rows. Pieces posted on central dark squares dominate the board.',
			'Advance your pieces in coordinated groups. Isolated pieces are easy targets for jumps.',
			'Avoid pushing pieces to the edges. Edge pieces have fewer escape squares and are easier to trap.',
			'Keep a reserve of pieces on your back rows to guard against early breakthroughs.'
		],
		middlegame: [
			'The middlegame in checkers is a tactical battle of forced captures. Every capture sequence reshapes the board.',
			'Sacrifice a piece to lure the opponent into a multi-jump that leaves you with a positional advantage.',
			'Control the long diagonal. A piece anchored on a diagonal that spans the board limits the opponent options.',
			'Watch for king-making opportunities. A piece that reaches the last rank becomes a powerful king that moves in all four diagonal directions.'
		],
		endgame: [
			'King endgames dominate checkers. A king against a man is a strong advantage but not always a win.',
			'Use your king to control both forward and backward diagonals. Kings are the decisive piece in the endgame.',
			'When ahead in material, simplify by forcing trades. Fewer pieces make your material advantage more decisive.',
			'A lone king against a lone king is a draw. Neither side can force a capture or blockade.'
		],
		mistakes: [
			'Ignoring a forced capture. The engine enforces mandatory jumps. If you have a capture available you must take it.',
			'Walking into a multi-jump trap. Before jumping, verify that the opponent cannot respond with a longer chain that leaves you worse.',
			'Advancing all pieces to the centre without guarding the back rows. A breakthrough on the back rank creates dangerous king threats.',
			'Pushing edge pieces. Edge pieces have fewer squares to escape to and are easily cornered.',
			'Not planning for king-making. A piece one square from the last rank is a king waiting to happen. Protect your advancing pieces and block the opponent.',
			'Treating every capture as equal. Some captures lead to strong multi-jumps; others leave you exposed. Choose captures that improve your position.'
		],
		timeAdvice: [
			'Bullet checkers is fast and tactical. Focus on forced capture sequences and avoid walking into traps.',
			'Blitz gives time to evaluate capture chains. Use the extra time to count the consequences of each jump.',
			'Rapid allows deeper calculation of multi-jump sequences. Map out the full chain before committing.',
			'Correspondence lets you study capture patterns at length. The tactical complexity rewards careful analysis.'
		],
		quickReference: [
			'Men move diagonally forward one square.',
			'Captures are mandatory jumps.',
			'Multi-jump chains continue while available.',
			'Kings move diagonally in all directions.',
			'Win by capturing all pieces or blocking all moves.',
			'No draws by repetition or fifty-move rule.'
		],
		win: [
			'Capture all opponent pieces or leave them with no legal move. The engine ends the game the instant either condition appears.',
			'Resignation and flag fall decide games as usual.'
		],
		rules: [
			'Captures are mandatory. If a capture is available you must make it.',
			'Multi-jump chains: after a jump, if the same piece can jump again it must continue.',
			'Kings crown automatically on the last rank and move diagonally in all directions.',
			'The game ends when one side has no pieces or no legal moves.'
		],
		tips: [
			'Control the centre rows. Pieces on central dark squares dominate the board.',
			'Keep a reserve on your back rows to guard against breakthroughs.',
			'Sacrifice to force a multi-jump that leaves you with a positional advantage.'
		]
	}
];

export function variantPageFor(id: string): VariantPage | undefined {
	return LEARN_VARIANT_PAGES.find((page) => page.id === id);
}
