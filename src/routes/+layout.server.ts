import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema';
import { vapidPublicKey } from '$lib/server/notifications';
import type { LayoutServerLoad } from './$types';

/**
 * Feeds the global nav: signed-in user, unread notification badge, and whether
 * the server has VAPID keys configured (gates the "Enable push" affordance).
 * The depends() key lets the client refresh just this load for light polling.
 */
export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:notifications:unread');

	let unreadCount = 0;
	if (locals.user) {
		const [row] = await db
			.select({ value: count() })
			.from(notifications)
			.where(and(eq(notifications.userId, locals.user.id), isNull(notifications.readAt)));
		unreadCount = row?.value ?? 0;
	}

	return {
		user: locals.user ? { name: locals.user.name, email: locals.user.email } : null,
		unreadCount,
		pushConfigured: vapidPublicKey() != null
	};
};
