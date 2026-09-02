import { and, eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { gamePlayers, ratings } from '$lib/server/db/schema';

import { isProvisional, updateRating } from './glicko2';
import type { Rating } from './glicko2';
import type { ResultValue, SpeedClass, VariantId } from '../chess/types';

/**
 * Applies Glicko-2 updates when a rated game finishes. Each finished game is
 * treated as one rating period; v0.1 does not batch periods.
 */

async function ensureRatingRow(
	userId: string,
	variant: VariantId,
	speed: SpeedClass
): Promise<Rating> {
	const [existing] = await db
		.select()
		.from(ratings)
		.where(
			and(eq(ratings.userId, userId), eq(ratings.variant, variant), eq(ratings.speedClass, speed))
		)
		.limit(1);
	if (existing) {
		return {
			rating: existing.rating,
			deviation: existing.deviation,
			volatility: existing.volatility
		};
	}
	const fresh = { rating: 1500, deviation: 350, volatility: 0.06 };
	await db
		.insert(ratings)
		.values({ userId, variant, speedClass: speed, ...fresh })
		.onConflictDoNothing();
	return fresh;
}

export async function applyRatedResult(input: {
	gameId: string;
	variant: VariantId;
	speed: SpeedClass;
	result: ResultValue;
	whiteId: string | null;
	blackId: string | null;
}): Promise<void> {
	const { gameId, variant, speed, result } = input;
	if (!input.whiteId || !input.blackId) return;

	const white = await ensureRatingRow(input.whiteId, variant, speed);
	const black = await ensureRatingRow(input.blackId, variant, speed);

	const whiteScore: 0 | 0.5 | 1 = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0;
	const blackScore: 0 | 0.5 | 1 = result === 'black' ? 1 : result === 'draw' ? 0.5 : 0;

	const whiteNew = updateRating(white, [{ opponent: black, score: whiteScore }]);
	const blackNew = updateRating(black, [{ opponent: white, score: blackScore }]);

	async function persist(
		userId: string,
		color: 'white' | 'black',
		before: Rating,
		after: Rating
	): Promise<void> {
		await db
			.update(ratings)
			.set({
				rating: after.rating,
				deviation: after.deviation,
				volatility: after.volatility,
				gamesPlayed: sql`${ratings.gamesPlayed} + 1`,
				updatedAt: new Date()
			})
			.where(
				and(eq(ratings.userId, userId), eq(ratings.variant, variant), eq(ratings.speedClass, speed))
			);
		await db
			.update(gamePlayers)
			.set({
				ratingBefore: Math.round(before.rating),
				ratingAfter: Math.round(after.rating),
				ratingDeviationBefore: Math.round(before.deviation),
				ratingDeviationAfter: Math.round(after.deviation)
			})
			.where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.color, color)));
	}

	await Promise.all([
		persist(input.whiteId, 'white', white, whiteNew),
		persist(input.blackId, 'black', black, blackNew)
	]);
}

export { isProvisional };
