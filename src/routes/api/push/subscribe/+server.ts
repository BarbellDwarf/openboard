import { json } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { vapidPublicKey } from '$lib/server/notifications';

/** Report the VAPID public key before prompting the user. */
export const OPTIONS: RequestHandler = async () => {
	return json({ publicKey: vapidPublicKey() });
};

/** Subscribe: upsert by endpoint. Also reports the VAPID public key. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as {
		endpoint?: string;
		keys?: { p256dh?: string; auth?: string };
	};
	if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
		return json({ ok: false }, { status: 422 });
	}
	await db
		.insert(pushSubscriptions)
		.values({
			userId: locals.user.id,
			endpoint: body.endpoint,
			p256dh: body.keys.p256dh,
			auth: body.keys.auth,
			lastUsedAt: new Date()
		})
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: {
				userId: locals.user.id,
				p256dh: body.keys.p256dh,
				auth: body.keys.auth,
				lastUsedAt: new Date()
			}
		});
	return json({ ok: true, publicKey: vapidPublicKey() });
};

/** Unsubscribe (client asked to remove a stale endpoint). */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as { endpoint?: string };
	if (!body.endpoint) return json({ ok: false }, { status: 422 });
	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
	return json({ ok: true });
};
