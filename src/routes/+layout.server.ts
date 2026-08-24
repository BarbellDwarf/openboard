import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { notifications, preferences } from '$lib/server/db/schema';
import { vapidPublicKey } from '$lib/server/notifications';
import type { LayoutServerLoad } from './$types';

/**
 * Feeds the global nav: signed-in user, unread notification badge, whether
 * the server has VAPID keys configured (gates the "Enable push" affordance),
 * and the caller's saved appearance preferences for the client-side store.
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

	// Same read path the /api/preferences GET serves; anonymous callers get
	// null and the client store falls back to defaults.
	let savedPreferences = null;
	if (locals.user) {
		const [row] = await db
			.select({
				boardTheme: preferences.boardTheme,
				pieceSet: preferences.pieceSet,
				soundsEnabled: preferences.soundsEnabled,
				soundVolume: preferences.soundVolume,
				autoQueen: preferences.autoQueen
			})
			.from(preferences)
			.where(eq(preferences.userId, locals.user.id))
			.limit(1);
		savedPreferences = row ?? null;
	}

	return {
		user: locals.user ? { name: locals.user.name, email: locals.user.email } : null,
		unreadCount,
		pushConfigured: vapidPublicKey() != null,
		preferences: savedPreferences
	};
};
