import { fail } from '@sveltejs/kit';

import { auth } from '$lib/server/auth';
import { applyPasswordReset } from '$lib/server/auth/reset-tokens';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD_LENGTH = 10;

/**
 * One page serves both reset paths: a token minted by an administrator on
 * /admin/users, or one emailed through better-auth's forget-password flow.
 * The admin path is spent here directly; the emailed token is delegated to
 * better-auth's reset endpoint. Either way the link works exactly once.
 */
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { hasToken: token.length > 0, token };
};

export const actions: Actions = {
	setPassword: async ({ request }) => {
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		const password = String(form.get('password') ?? '');

		if (!token) return fail(422, { error: 'This reset link is missing its code.' });
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(422, { error: `Passwords are at least ${MIN_PASSWORD_LENGTH} characters.` });
		}

		let outcome = await applyPasswordReset(token, password);
		if (outcome === 'invalid-token') {
			// Maybe it came from the emailed forget-password flow instead.
			try {
				await auth.api.resetPassword({ body: { newPassword: password, token } });
				outcome = 'ok';
			} catch {
				outcome = 'invalid-token';
			}
		}

		switch (outcome) {
			case 'ok':
				return { success: true as const };
			case 'no-password-account':
				return fail(422, {
					error: 'This account signs in through single sign-on and has no password to reset.'
				});
			case 'invalid-token':
				return fail(422, {
					error: 'This reset code is invalid, was already used, or has expired.'
				});
		}
	}
};
