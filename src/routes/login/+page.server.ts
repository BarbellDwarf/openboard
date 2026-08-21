import { redirect } from '@sveltejs/kit';

import { oidcProvidersFromEnv } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.session) throw redirect(302, '/');
	return {
		oidcEnabled: oidcProvidersFromEnv().length > 0,
		oidcName: oidcProvidersFromEnv()[0]?.providerId ?? 'oidc',
		returnTo: url.searchParams.get('returnTo') ?? '/'
	};
};
