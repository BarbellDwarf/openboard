import { error, fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { isAdminUser } from '$lib/server/auth/roles';
import { issuePasswordResetToken } from '$lib/server/auth/reset-tokens';
import type { Actions, PageServerLoad } from './$types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Roster of accounts, visible only to administrators. Emails and roles come
 * straight from the users table; no credentials exist on that table to leak.
 * The reset action mints a single-use token the admin relays by hand, which
 * is what makes password recovery work on servers with no outgoing email.
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
			emailVerified: users.emailVerified,
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
			emailVerified: u.emailVerified,
			createdAtMs: u.createdAt.getTime()
		}))
	};
};

export const actions: Actions = {
	resetPassword: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login?returnTo=/admin/users');
		if (!(await isAdminUser(locals.user.id))) throw error(403, 'Admins only.');

		const form = await request.formData();
		const userId = form.get('userId');
		if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
			return fail(400, { error: 'Unknown account.' });
		}

		const found = await db
			.select({ id: users.id, name: users.name })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (found.length === 0) return fail(404, { error: 'Account not found.' });

		const { token } = await issuePasswordResetToken(found[0].id, locals.user.id);
		return { issued: { name: found[0].name, token } };
	}
};
