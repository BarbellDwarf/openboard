import { asc, and, eq, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { chatMessages } from '$lib/server/db/schema';

export async function historyFor(gameId: string) {
	return db
		.select()
		.from(chatMessages)
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

export async function softDelete(id: number, userId: string): Promise<boolean> {
	const rows = await db
		.update(chatMessages)
		.set({ deletedAt: new Date() })
		.where(and(eq(chatMessages.id, id), eq(chatMessages.userId, userId)))
		.returning({ id: chatMessages.id });
	return rows.length > 0;
}
