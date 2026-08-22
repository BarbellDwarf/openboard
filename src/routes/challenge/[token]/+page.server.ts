import { error } from '@sveltejs/kit';

import { challengeByToken } from '$lib/server/matchmaking';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const challenge = await challengeByToken(params.token);
	if (!challenge) throw error(404, 'Challenge not found.');
	return {
		challenge,
		signedIn: !!locals.user,
		isChallenger: !!locals.user && locals.user.id === challenge.challengerId
	};
};
