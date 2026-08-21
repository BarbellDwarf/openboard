import { auth } from './index';

/**
 * Resolve a session from a raw Cookie header. Used by the Socket.IO
 * handshake middleware, which has no SvelteKit event context.
 */
export async function getSessionFromCookieHeader(
	cookieHeader: string | undefined
): Promise<{ userId: string; sessionId: string } | null> {
	if (!cookieHeader) return null;
	const session = await auth.api.getSession({
		headers: new Headers({ cookie: cookieHeader })
	});
	if (!session) return null;
	return { userId: session.user.id, sessionId: session.session.id };
}
