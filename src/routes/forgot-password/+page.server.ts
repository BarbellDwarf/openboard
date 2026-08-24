import { fail } from '@sveltejs/kit';

import { auth } from '$lib/server/auth';
import { isMailConfigured } from '$lib/server/mail';
import type { Actions, PageServerLoad } from './$types';

/**
 * Identical handling for every request outcome: unknown accounts, disabled
 * mail, and provider hiccups all return the same success shape, so this
 * form cannot be used to learn which addresses exist. The neutral wording
 * lives in +page.svelte; nothing here distinguishes the failure modes.
 */
export const load: PageServerLoad = async () => {
	return { mailEnabled: isMailConfigured() };
};

export const actions: Actions = {
	request: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(422, { error: 'Enter a valid email address.' });
		}

		try {
			await auth.api.requestPasswordReset({
				body: {
					email,
					redirectTo: '/reset-password'
				}
			});
		} catch {
			// Swallowed on purpose. better-auth already returns a neutral answer
			// for unknown accounts; disabled SMTP surfaces here as an error and
			// must look identical to every other outcome.
		}
		return { sent: true as const };
	}
};
