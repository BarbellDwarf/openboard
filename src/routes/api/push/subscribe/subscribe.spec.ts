import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Subscription storage is scoped to the caller's own rows. A replayed foreign
 * endpoint must match zero owned rows, store nothing, and answer 403 instead
 * of a success that stored nothing.
 */

const dbMock = vi.hoisted(() => {
	const returningRows: unknown[][] = [];
	const lastInsert: { values?: unknown } = {};
	const db = {
		insert(_table: unknown) {
			const builder = {
				values(values: unknown) {
					lastInsert.values = values;
					return builder;
				},
				onConflictDoUpdate() {
					return builder;
				},
				async returning() {
					return returningRows.length > 0 ? returningRows.shift() : [];
				}
			};
			return builder;
		}
	};
	return { db, returningRows, lastInsert };
});
vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

const notificationsMock = vi.hoisted(() => ({
	vapidPublicKey: vi.fn(() => 'test-vapid-public-key')
}));
vi.mock('$lib/server/notifications', () => notificationsMock);

import { POST } from './+server';

type PostEvent = Parameters<typeof POST>[0];

function postEvent(payload: unknown, userId: string | null): PostEvent {
	return {
		request: new Request('https://openboard.example.com/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}),
		locals: { user: userId ? { id: userId } : null }
	} as unknown as PostEvent;
}

const subscription = {
	endpoint: 'https://push.example.com/send/abc',
	keys: { p256dh: 'p256dh-key', auth: 'auth-key' }
};

beforeEach(() => {
	dbMock.returningRows.length = 0;
});

describe('POST /api/push/subscribe', () => {
	it('stores a fresh subscription and reports the VAPID key', async () => {
		dbMock.returningRows.push([{ id: 'sub-1' }]);

		const res = await POST(postEvent(subscription, 'user-1'));
		const body = (await res.json()) as Record<string, unknown>;

		expect(res.status).toBe(200);
		expect(body).toEqual({ ok: true, publicKey: 'test-vapid-public-key' });
		expect(dbMock.lastInsert.values).toMatchObject({
			userId: 'user-1',
			endpoint: subscription.endpoint
		});
	});

	it('updates an endpoint the caller already owns', async () => {
		dbMock.returningRows.push([{ id: 'sub-2' }]);

		const res = await POST(postEvent(subscription, 'user-1'));

		expect(res.status).toBe(200);
	});

	it('answers 403 when a replay matches zero owned rows', async () => {
		// The conflict update is scoped to rows the caller owns, so another
		// user's endpoint stores nothing and returns no rows.
		dbMock.returningRows.push([]);

		const res = await POST(postEvent(subscription, 'freeloader'));
		const body = (await res.json()) as Record<string, unknown>;

		expect(res.status).toBe(403);
		expect(body.ok).toBe(false);
	});

	it('rejects incomplete payloads before touching storage', async () => {
		const res = await POST(
			postEvent({ endpoint: subscription.endpoint, keys: { p256dh: 'only' } }, 'user-1')
		);

		expect(res.status).toBe(422);
	});

	it('requires a signed-in caller', async () => {
		const res = await POST(postEvent(subscription, null));

		expect(res.status).toBe(401);
	});
});
