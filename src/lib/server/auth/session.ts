import { and, eq, gt } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';

/**
 * Resolve a session from a raw Cookie header. Used by the Socket.IO handshake,
 * which has no SvelteKit event context. Looks up the session table directly so
 * the realtime bundle carries no framework dependencies.
 *
 * Better Auth cookie values are `<token>.<signature>`; the database stores the
 * bare token.
 */
export async function getSessionFromCookieHeader(
	cookieHeader: string | undefined
): Promise<{ userId: string; sessionId: string } | null> {
	if (!cookieHeader) return null;
	let token: string | undefined;
	for (const part of cookieHeader.split(';')) {
		const idx = part.indexOf('=');
		if (idx === -1) continue;
		const name = part.slice(0, idx).trim();
		if (name === 'better-auth.session_token') {
			token = decodeURIComponent(part.slice(idx + 1).trim());
			break;
		}
	}
	if (!token) return null;
	const bare = token.includes('.') ? token.slice(0, token.indexOf('.')) : token;
	const [row] = await db
		.select({ userId: sessions.userId, id: sessions.id })
		.from(sessions)
		.where(and(eq(sessions.token, bare), gt(sessions.expiresAt, new Date())))
		.limit(1);
	return row ? { userId: row.userId, sessionId: row.id } : null;
}
