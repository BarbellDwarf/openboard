import { asc, and, eq, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { chatMessages, users } from '$lib/server/db/schema';

export async function historyFor(gameId: string) {
	return db
		.select({
			id: chatMessages.id,
			userId: chatMessages.userId,
			name: users.name,
			body: chatMessages.body,
			createdAt: chatMessages.createdAt
		})
		.from(chatMessages)
		.innerJoin(users, eq(users.id, chatMessages.userId))
		.where(and(eq(chatMessages.gameId, gameId), isNull(chatMessages.deletedAt)))
		.orderBy(asc(chatMessages.createdAt));
}

export async function addMessage(gameId: string, userId: string, body: string): Promise<number> {
	const [row] = await db
		.insert(chatMessages)
		.values({ gameId, userId, body })
		.returning({ id: chatMessages.id });
	return row.id;
}

/**
 * Soft-delete one message. Authors may remove their own; passing { admin }
 * lets an administrator remove anyone's. Unknown ids and messages the caller
 * may not touch both return false, so the two failures stay indistinguishable.
 */
export async function softDelete(
	id: number,
	userId: string,
	opts: { admin?: boolean } = {}
): Promise<boolean> {
	const claim = opts.admin
		? eq(chatMessages.id, id)
		: and(eq(chatMessages.id, id), eq(chatMessages.userId, userId));
	const rows = await db
		.update(chatMessages)
		.set({ deletedAt: new Date() })
		.where(claim)
		.returning({ id: chatMessages.id });
	return rows.length > 0;
}
