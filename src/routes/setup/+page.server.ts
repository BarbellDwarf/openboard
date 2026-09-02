import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth';

import { auth } from '$lib/server/auth';
import { hasAdmin, promoteToAdmin } from '$lib/server/auth/roles';
import type { Actions, PageServerLoad } from './$types';

/**
 * First-run bootstrap. The gate is server-side on both paths and tracks
 * administrators, not raw user count: a fresh deploy shows the form because
 * zero users means zero admins, an upgraded deployment with ordinary users
 * keeps its recovery path, and the moment one admin exists the form and the
 * creation action are both closed for good.
 */
export const load: PageServerLoad = async () => {
	return { setupComplete: await hasAdmin() };
};

export const actions: Actions = {
	default: async ({ request }) => {
		if (await hasAdmin()) {
			// Same "Setup is complete" page, 403 semantics, nothing revealed.
			return fail(403, { setupComplete: true, error: null });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (name.length < 3 || name.length > 24) {
			return fail(422, { setupComplete: false, error: 'Username needs 3 to 24 characters.' });
		}
		if (!email) {
			return fail(422, { setupComplete: false, error: 'Enter an email address.' });
		}
		if (password.length < 10) {
			return fail(422, {
				setupComplete: false,
				error: 'Password needs at least 10 characters.'
			});
		}

		let userId: string;
		try {
			// better-auth's own sign-up path hashes the password, persists the
			// account, and starts a session; the sveltekitCookies plugin lands
			// the session cookie on this response, so the creator signs in.
			const created = await auth.api.signUpEmail({ body: { name, email, password } });
			userId = created.user.id;
		} catch (error) {
			if (error instanceof APIError) {
				const status = typeof error.status === 'number' && error.status >= 400 ? error.status : 400;
				return fail(status, {
					setupComplete: false,
					error: error.message || 'Could not create the account. Try a different email.'
				});
			}
			throw error;
		}

		// Guarded promotion: if another request finished setup first, this
		// account stays a plain user and the page closes.
		if (!(await promoteToAdmin(userId))) {
			return fail(403, { setupComplete: true, error: null });
		}

		redirect(303, '/');
	}
};
