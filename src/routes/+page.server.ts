import { hasAdmin } from '$lib/server/auth/roles';
import type { PageServerLoad } from './$types';

/**
 * Tells the landing page whether this deployment still needs its first-run
 * setup, so signed-out visitors get pointed at /setup until an admin exists.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) return { needsSetup: false };
	return { needsSetup: !(await hasAdmin()) };
};
