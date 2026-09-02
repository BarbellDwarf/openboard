import { error, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { isAdminUser } from '$lib/server/auth/roles';
import type { PageServerLoad } from './$types';

/**
 * Roster of accounts, visible only to administrators. Emails and roles come
 * straight from the users table; no credentials exist on that table to leak.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login?returnTo=/admin/users');
	if (!(await isAdminUser(locals.user.id))) throw error(403, 'Admins only.');

	const rows = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(asc(users.createdAt))
		.limit(500);

	return {
		users: rows.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			admin: u.role === 'admin',
			createdAtMs: u.createdAt.getTime()
		}))
	};
};
