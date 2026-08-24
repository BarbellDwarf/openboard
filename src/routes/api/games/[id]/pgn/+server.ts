import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { games } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Cheap guard so malformed ids answer 404 instead of a database error. */
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Download the stored PGN. Seated players may export their own games at any
 * point; everyone else only after the game is finished. Game pages let anyone
 * watch a running game through its socket room, but the export keeps running
 * games private to the players.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!UUID_LIKE.test(params.id)) return notFound();

	const [game] = await db
		.select({
			status: games.status,
			pgn: games.pgn,
			whiteId: games.whiteId,
			blackId: games.blackId
		})
		.from(games)
		.where(eq(games.id, params.id))
		.limit(1);

	if (!game) return notFound();
	// The column fills on the first persisted move, so a game with zero moves
	// (aborted, or lost on time untouched) has nothing to download yet.
	if (!game.pgn) return notFound();

	const seated =
		locals.user != null && (locals.user.id === game.whiteId || locals.user.id === game.blackId);
	if (!seated && game.status !== 'finished') {
		return new Response(null, { status: 403 });
	}

	return new Response(game.pgn, {
		status: 200,
		headers: {
			'Content-Type': 'text/chess; charset=utf-8',
			'Content-Disposition': `attachment; filename="openboard-${params.id}.pgn"`
		}
	});
};

function notFound(): Response {
	return new Response(null, { status: 404 });
}
