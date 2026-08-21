import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';

import { db } from '$lib/server/db';
import { oauthAccounts, sessions, users } from '$lib/server/db/schema';

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

export const auth = betterAuth({
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
		minPasswordLength: 10
	},
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
