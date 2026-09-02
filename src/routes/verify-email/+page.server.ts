import { auth } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

/**
 * Soft email verification. The link from the sign-up mail lands here; a
 * valid token flips the user's verified flag through better-auth. Nothing
 * about sign-in changes either way: an unverified player keeps playing.
 */
export const load: PageServerLoad = async ({ url, request }) => {
	const token = url.searchParams.get('token');
	if (!token) return { state: 'missing' as const };

	try {
		await auth.api.verifyEmail({ query: { token }, headers: request.headers });
		return { state: 'verified' as const };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return { state: 'invalid' as const, reason: message };
	}
};
