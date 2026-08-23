import { and, eq, notExists } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

/**
 * Roles and moderation permissions.
 *
 * `users.role` is plain text; the value 'admin' unlocks moderation powers and
 * every other value is a plain user. The predicates here are the single
 * authority for what an admin may do: endpoints and socket handlers build an
 * actor from their session, then ask. Clients may hide controls, but these
 * checks are the gate that actually holds.
 */

export type UserRole = 'admin' | 'user';

export interface Actor {
	id: string;
	role: string;
}

/** Only administrators may close other people's games. */
export function mayCloseGame(actor: Actor | null): boolean {
	return actor?.role === 'admin';
}

/**
 * Chat deletion is author-only by default; an administrator may moderate any
 * message. Signed-out callers may never delete.
 */
export function mayDeleteChatMessage(actor: Actor | null, authorId: string): boolean {
	if (!actor) return false;
	return actor.role === 'admin' || actor.id === authorId;
}

/** True once any administrator account exists. Drives the /setup gate. */
export async function hasAdmin(): Promise<boolean> {
	const [row] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.role, 'admin'))
		.limit(1);
	return row != null;
}

/** Live role lookup against the database; never trust a cached claim. */
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
	if (!userId) return false;
	const [row] = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return row?.role === 'admin';
}

/**
 * Flip a freshly created account to admin only while no administrator exists.
 * Two guards stack here. The NOT EXISTS predicate keeps the common path in one
 * statement; under READ COMMITTED two concurrent setups can still both observe
 * zero admins, so the partial unique index on role='admin' (migration 0002)
 * settles that race at the storage layer: the losing UPDATE raises 23505 and
 * is reported as a lost claim. The caller should treat false as
 * "setup closed".
 */
export async function promoteToAdmin(userId: string): Promise<boolean> {
	try {
		const updated = await db
			.update(users)
			.set({ role: 'admin' })
			.where(
				and(eq(users.id, userId), notExists(db.select().from(users).where(eq(users.role, 'admin'))))
			)
			.returning({ id: users.id });
		return updated.length > 0;
	} catch (error) {
		// Unique violation on the partial admin index: another setup won.
		if (
			typeof error === 'object' &&
			error !== null &&
			(error as { code?: string }).code === '23505'
		) {
			return false;
		}
		throw error;
	}
}
