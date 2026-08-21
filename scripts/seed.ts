/**
 * Development seed. Inserts two test users with profiles and preferences plus
 * one sample standard game with a short move list. Safe to re-run: rows are
 * upserted by natural keys.
 *
 * Run with: npm run db:seed
 */
import { eq } from 'drizzle-orm';

import { db, pool } from '../src/lib/server/db';
import { games, moves, preferences, profiles, users } from '../src/lib/server/db/schema';

const TEST_USERS = [
	{ name: 'test-user-one', email: 'test-user-one@example.com' },
	{ name: 'test-user-two', email: 'test-user-two@example.com' }
] as const;

async function upsertUser(name: string, email: string) {
	const [row] = await db
		.insert(users)
		.values({ name, email })
		.onConflictDoUpdate({ target: users.email, set: { name } })
		.returning();
	await db.insert(profiles).values({ userId: row.id }).onConflictDoNothing();
	await db.insert(preferences).values({ userId: row.id }).onConflictDoNothing();
	return row;
}

async function main() {
	const [one, two] = await Promise.all(TEST_USERS.map((u) => upsertUser(u.name, u.email)));

	const existing = await db.select().from(games).where(eq(games.status, 'started')).limit(1);
	if (existing.length === 0) {
		const [game] = await db
			.insert(games)
			.values({
				variant: 'standard',
				rated: false,
				initialMs: 300000,
				incrementMs: 2000,
				status: 'started',
				currentXfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
				whiteId: one.id,
				blackId: two.id,
				startedAt: new Date()
			})
			.returning();
		await db.insert(moves).values([
			{
				gameId: game.id,
				ply: 1,
				uci: 'e2e4',
				san: 'e4',
				xfenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
			},
			{
				gameId: game.id,
				ply: 2,
				uci: 'e7e5',
				san: 'e5',
				xfenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
			}
		]);
		console.log('Seeded sample game', game.id);
	}

	console.log('Seed complete.');
	await pool.end();
}

main().catch(async (err) => {
	console.error(err);
	await pool.end();
	process.exit(1);
});
