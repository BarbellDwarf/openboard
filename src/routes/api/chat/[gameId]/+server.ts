import { json } from '@sveltejs/kit';

import { addMessage, historyFor, softDelete } from '$lib/server/chat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	return json({ messages: await historyFor(params.gameId) });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as { body?: string; deleteId?: number };
	if (body.deleteId != null) {
		const ok = await softDelete(body.deleteId, locals.user.id);
		return json({ ok });
	}
	const text = (body.body ?? '').slice(0, 500).trim();
	if (!text) return json({ ok: false }, { status: 422 });
	const id = await addMessage(params.gameId, locals.user.id, text);
	return json({ ok: true, id });
};
