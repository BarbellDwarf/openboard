import { json } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { vapidPublicKey } from '$lib/server/notifications';

/** Report the VAPID public key before prompting the user. */
export const OPTIONS: RequestHandler = async () => {
	return json({ publicKey: vapidPublicKey() });
};

/**
 * Subscribe: upsert by endpoint. Also reports the VAPID public key.
 * The conflict update is scoped to rows the caller already owns, so one user
 * can never take over another user's subscription by replaying their endpoint.
 */
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
			setWhere: and(
				eq(pushSubscriptions.endpoint, body.endpoint),
				eq(pushSubscriptions.userId, locals.user.id)
			),
			set: {
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
	// Scope the delete to the caller: one user must not remove another's subscription.
	await db
		.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.endpoint, body.endpoint),
				eq(pushSubscriptions.userId, locals.user.id)
			)
		);
	return json({ ok: true });
};
