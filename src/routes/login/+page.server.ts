import { redirect } from '@sveltejs/kit';

import { oidcProvidersFromEnv } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.session) throw redirect(302, '/');
	const requested = url.searchParams.get('returnTo') ?? '/';
	const returnTo = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
	const providers = oidcProvidersFromEnv();
	return {
		oidcEnabled: providers.length > 0,
		oidcName: providers[0]?.providerId ?? 'oidc',
		returnTo
	};
};
