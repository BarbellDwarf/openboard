import { error } from '@sveltejs/kit';

import { VARIANTS } from '$lib/server/chess/types';
import type { PageServerLoad } from './$types';

import { variantPageFor } from '../content';

/**
 * The slug set is validated against the engine's VariantId union so /learn
 * can never drift from the rulesets the server actually plays.
 */
export const load: PageServerLoad = ({ params }) => {
	const page = variantPageFor(params.variant);
	if (!page || !(VARIANTS as readonly string[]).includes(params.variant)) {
		throw error(404, 'Unknown ruleset.');
	}
	return { page };
};
