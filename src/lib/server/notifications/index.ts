import webpush from 'web-push';

import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { notifications, pushSubscriptions } from '$lib/server/db/schema';

/**
 * Web Push sending. VAPID keys come from env; when absent, sends are skipped
 * so development never crashes on missing keys.
 */

let configured: { publicKey: string; privateKey: string } | null = null;

function ensureConfigured(): boolean {
	if (configured) return true;
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';
	if (!publicKey || !privateKey) return false;
	webpush.setVapidDetails(subject, publicKey, privateKey);
	configured = { publicKey, privateKey };
	return true;
}

export function vapidPublicKey(): string | null {
	return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendToUser(
	userId: string,
	payload: { title: string; body: string; url?: string; tag?: string }
): Promise<void> {
	if (!ensureConfigured()) return;

	const rows = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId));

	await Promise.allSettled(
		rows.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					JSON.stringify(payload),
					{ TTL: 3600 }
				);
				void db
					.update(pushSubscriptions)
					.set({ lastUsedAt: new Date() })
					.where(eq(pushSubscriptions.id, sub.id));
			} catch (err) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 404 || status === 410) {
					void db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
				}
			}
		})
	);
}

/** Persist an in-app notification and fan out to web push subscribers. */
export async function notifyUser(
	userId: string,
	type: string,
	payload: Record<string, unknown>
): Promise<void> {
	await db.insert(notifications).values({ userId, type, payload });
	const body = typeof payload.body === 'string' ? payload.body : 'Update in your games.';
	const url = typeof payload.url === 'string' ? payload.url : '/';
	await sendToUser(userId, { title: 'OpenBoard', body, url, tag: type });
}
