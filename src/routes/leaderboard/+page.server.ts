import { and, desc, eq, gt } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { ratings, users } from '$lib/server/db/schema';
import { VARIANTS, type SpeedClass, type VariantId } from '$lib/server/chess/types';
import type { PageServerLoad } from './$types';

const SPEEDS: SpeedClass[] = ['bullet', 'blitz', 'rapid', 'classical'];

export const load: PageServerLoad = async ({ url }) => {
	const variantParam = url.searchParams.get('variant') as VariantId | null;
	const speedParam = url.searchParams.get('speed') as SpeedClass | null;
	const variant: VariantId =
		variantParam && VARIANTS.includes(variantParam) ? variantParam : 'standard';
	const speed: SpeedClass = speedParam && SPEEDS.includes(speedParam) ? speedParam : 'blitz';

	const rows = await db
		.select({
			name: users.name,
			rating: ratings.rating,
			deviation: ratings.deviation,
			gamesPlayed: ratings.gamesPlayed
		})
		.from(ratings)
		.innerJoin(users, eq(users.id, ratings.userId))
		.where(
			and(eq(ratings.variant, variant), eq(ratings.speedClass, speed), gt(ratings.gamesPlayed, 0))
		)
		.orderBy(desc(ratings.rating))
		.limit(50);

	return { variant, speed, variants: VARIANTS, speeds: SPEEDS, rows };
};
