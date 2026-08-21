/**
 * Typed environment configuration.
 *
 * Reads process.env once at import time. Missing required variables throw an
 * error that names the variable, so misconfiguration fails fast at startup.
 */

function requireVar(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === '') {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function optionalVar(name: string): string | undefined {
	const value = process.env[name];
	return value === undefined || value === '' ? undefined : value;
}

function portFromEnv(): number {
	const raw = optionalVar('PORT');
	if (raw === undefined) {
		return 3000;
	}
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 0 || port > 65535) {
		throw new Error(`Invalid PORT value: ${raw}. Use an integer between 0 and 65535.`);
	}
	return port;
}

/**
 * Validates a group of related variables. A group counts as present when at
 * least one of its variables is set. Partial groups throw and name the gaps.
 */
function validateGroup(name: string, keys: readonly string[]): void {
	const present = keys.filter((key) => optionalVar(key) !== undefined);
	if (present.length === 0 || present.length === keys.length) {
		return;
	}
	const missing = keys.filter((key) => !present.includes(key));
	throw new Error(
		`Incomplete ${name} configuration. Missing environment variables: ${missing.join(', ')}`
	);
}

const VAPID_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
const OIDC_KEYS = [
	'OIDC_ISSUER_URL',
	'OIDC_CLIENT_ID',
	'OIDC_CLIENT_SECRET',
	'OIDC_PROVIDER_NAME'
] as const;

if (
	process.env.NODE_ENV === 'production' &&
	!process.env.BETTER_AUTH_SECRET &&
	!process.env.BUILDING
) {
	throw new Error('Missing environment variable: BETTER_AUTH_SECRET');
}

validateGroup('Web Push (VAPID)', VAPID_KEYS);
validateGroup('OIDC', OIDC_KEYS);

export const config = {
	port: portFromEnv(),
	host: optionalVar('HOST') ?? '0.0.0.0',
	databaseUrl: requireVar('DATABASE_URL'),
	origin: requireVar('ORIGIN'),
	vapid: {
		publicKey: optionalVar('VAPID_PUBLIC_KEY'),
		privateKey: optionalVar('VAPID_PRIVATE_KEY'),
		subject: optionalVar('VAPID_SUBJECT')
	},
	oidc: {
		issuerUrl: optionalVar('OIDC_ISSUER_URL'),
		clientId: optionalVar('OIDC_CLIENT_ID'),
		clientSecret: optionalVar('OIDC_CLIENT_SECRET'),
		providerName: optionalVar('OIDC_PROVIDER_NAME')
	}
};

export type Config = typeof config;

/** True when all Web Push variables are set. */
export const pushEnabled =
	config.vapid.publicKey !== undefined &&
	config.vapid.privateKey !== undefined &&
	config.vapid.subject !== undefined;

/** True when the OIDC provider is configured. */
export const oidcEnabled =
	config.oidc.issuerUrl !== undefined && config.oidc.clientId !== undefined;
