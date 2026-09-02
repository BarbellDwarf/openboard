import { json } from '@sveltejs/kit';

import { applyMove } from '$lib/server/chess/engine';
import { loadPosition } from '$lib/server/chess/engine';
import { stateFromPosition } from '$lib/server/chess/engine';
import type { VariantId } from '$lib/server/chess/types';
import type { RequestHandler } from './$types';

/**
 * Demo-board state service. Applies a move when uci is given, otherwise
 * returns the legal-move map for the position. Keeps the engine server-side.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { xfen?: string; uci?: string; variant?: string };
	const variant = (body.variant ?? 'standard') as VariantId;
	if (!body.xfen) return json({ ok: false }, { status: 400 });

	try {
		const pos = loadPosition(variant, body.xfen);
		const current = stateFromPosition(pos, variant);

		let san: string | undefined;
		let next = current;
		if (body.uci) {
			const result = applyMove(variant, body.xfen, body.uci);
			if (!result.ok) return json({ ok: false, reason: result.error }, { status: 422 });
			san = result.san;
			next = result.state;
		}

		return json({
			ok: true,
			xfen: next.xfen,
			dests: next.dests,
			turn: next.turn,
			inCheck: next.inCheck,
			san
		});
	} catch {
		return json({ ok: false, reason: 'invalid-position' }, { status: 422 });
	}
};
