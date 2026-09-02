import { redirect } from '@sveltejs/kit';

import { listOpenChallenges } from '$lib/server/matchmaking';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login?returnTo=/lobby');
	return { challenges: await listOpenChallenges() };
};
