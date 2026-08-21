import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();

/** The OIDC provider id, matching the server env configuration. */
export const oidcProviderId = process.env.OIDC_PROVIDER_NAME ?? 'oidc';
