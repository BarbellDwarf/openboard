import { json } from '@sveltejs/kit';

import { addMessage, historyFor, softDelete } from '$lib/server/chat';
import { playerColorFor } from '$lib/server/chess/game-service';
import { isAdminUser } from '$lib/server/auth/roles';
import type { RequestHandler } from './$types';

/** Same limits as the realtime path: five messages per ten seconds per user. */
const recentPosts = new Map<string, number[]>();

function rateLimited(userId: string, nowMs: number): boolean {
	const times = (recentPosts.get(userId) ?? []).filter((t) => nowMs - t < 10_000);
	if (times.length >= 5) return true;
	times.push(nowMs);
	recentPosts.set(userId, times);
	return false;
}

export const GET: RequestHandler = async ({ params }) => {
	return json({ messages: await historyFor(params.gameId) });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as { body?: string; deleteId?: number };
	if (body.deleteId != null) {
		// Authors delete their own messages; administrators moderate any of them.
		const admin = await isAdminUser(locals.user.id);
		const ok = await softDelete(body.deleteId, locals.user.id, { admin });
		return json({ ok });
	}
	// Only seated players may post; spectators stay read-only.
	if (!(await playerColorFor(params.gameId, locals.user.id))) {
		return json({ ok: false, reason: 'not-a-player' }, { status: 403 });
	}
	if (rateLimited(locals.user.id, Date.now())) {
		return json({ ok: false, reason: 'rate-limited' }, { status: 429 });
	}
	const text = (body.body ?? '').slice(0, 500).trim();
	if (!text) return json({ ok: false }, { status: 422 });
	const id = await addMessage(params.gameId, locals.user.id, text);
	return json({ ok: true, id });
};
