import { json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as { id?: number; all?: boolean };
	if (body.all) {
		await db
			.update(notifications)
			.set({ readAt: new Date() })
			.where(and(eq(notifications.userId, locals.user.id), isNull(notifications.readAt)));
		return json({ ok: true });
	}
	if (body.id == null) return json({ ok: false }, { status: 422 });
	await db
		.update(notifications)
		.set({ readAt: new Date() })
		.where(and(eq(notifications.id, body.id), eq(notifications.userId, locals.user.id)));
	return json({ ok: true });
};
