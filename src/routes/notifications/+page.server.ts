import { redirect } from '@sveltejs/kit';
import { desc, eq, isNull, and } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema';
import { vapidPublicKey } from '$lib/server/notifications';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login?returnTo=/notifications');
	const rows = await db
		.select()
		.from(notifications)
		.where(and(eq(notifications.userId, locals.user.id), isNull(notifications.readAt)))
		.orderBy(desc(notifications.createdAt))
		.limit(50);
	return {
		rows: rows.map((r) => ({ id: r.id, type: r.type, payload: r.payload, createdAt: r.createdAt })),
		publicKey: vapidPublicKey()
	};
};
