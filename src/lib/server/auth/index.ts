import { building } from '$app/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';

import { db } from '$lib/server/db';
import { oauthAccounts, sessions, users } from '$lib/server/db/schema';
import { isMailConfigured, sendMail } from '$lib/server/mail';

export interface OidcProviderConfig {
	providerId: string;
	clientId: string;
	clientSecret: string;
	discoveryUrl: string;
	name?: string;
}

/** OIDC providers come entirely from environment. Nothing is hard-coded. */
export function oidcProvidersFromEnv(): OidcProviderConfig[] {
	const issuer = process.env.OIDC_ISSUER_URL;
	const clientId = process.env.OIDC_CLIENT_ID;
	const clientSecret = process.env.OIDC_CLIENT_SECRET;
	if (!issuer || !clientId || !clientSecret) return [];
	const base = issuer.replace(/\/$/, '');
	return [
		{
			providerId: process.env.OIDC_PROVIDER_NAME ?? 'oidc',
			clientId,
			clientSecret,
			discoveryUrl: `${base}/.well-known/openid-configuration`
		}
	];
}

function authSecret(): string {
	const fromEnv = process.env.BETTER_AUTH_SECRET;
	if (fromEnv) return fromEnv;
	if (process.env.NODE_ENV === 'production' && !building) {
		throw new Error('BETTER_AUTH_SECRET must be set when NODE_ENV is production.');
	}
	return 'openboard-dev-secret-do-not-use-in-production';
}

/** Public origin of the app. Used to build links inside outgoing email. */
function appOrigin(): string {
	return process.env.ORIGIN ?? process.env.BETTER_AUTH_URL ?? '';
}

/**
 * Email-dependent auth hooks exist only while SMTP is configured. Without
 * SMTP the options stay undefined: better-auth refuses forget-password
 * requests and no verification mail is queued, while sign-up and sign-in
 * behave exactly as they do on a mailless server.
 */
const mailHooks = isMailConfigured()
	? {
			sendResetPassword: async ({ user, token }: { user: { email: string }; token: string }) => {
				const url = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
				await sendMail({
					to: user.email,
					subject: 'Reset your OpenBoard password',
					text: [
						'Hello,',
						'',
						'Someone asked for a password reset for your OpenBoard account.',
						'Open this link within one hour to choose a new password:',
						'',
						url,
						'',
						'If this was you, you can safely ignore this mail.'
					].join('\n')
				});
			}
		}
	: {};

const verificationHooks = isMailConfigured()
	? {
			// Soft verification: a mail goes out on sign-up, but nothing blocks
			// sign-in while the address stays unverified.
			sendOnSignUp: true,
			sendVerificationEmail: async ({
				user,
				token
			}: {
				user: { email: string };
				token: string;
			}) => {
				const url = `${appOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
				await sendMail({
					to: user.email,
					subject: 'Verify your OpenBoard email',
					text: [
						'Hello,',
						'',
						'Confirm your email address by opening this link:',
						'',
						url,
						'',
						'You can keep playing either way; this only proves the address is yours.'
					].join('\n')
				});
			}
		}
	: undefined;

export const auth = betterAuth({
	secret: authSecret(),
	baseURL: process.env.ORIGIN ?? process.env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: users,
			session: sessions,
			account: oauthAccounts
		}
	}),
	advanced: {
		database: {
			generateId: () => crypto.randomUUID()
		}
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		resetPasswordTokenExpiresIn: 60 * 60,
		...mailHooks
	},
	emailVerification: verificationHooks,
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24
	},
	account: {
		accountLinking: {
			trustedProviders: ['oidc']
		}
	},
	plugins: [
		genericOAuth({
			config: oidcProvidersFromEnv().map((p) => ({
				providerId: p.providerId,
				clientId: p.clientId,
				clientSecret: p.clientSecret,
				discoveryUrl: p.discoveryUrl,
				pkce: true
			}))
		}),
		sveltekitCookies(getRequestEvent)
	]
});

export type Auth = typeof auth;
