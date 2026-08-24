import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { oauthAccounts, passwordResetTokens, sessions } from '$lib/server/db/schema';
import { auth } from './index';

/**
 * Administrator-issued password resets. An admin generates an opaque token
 * on /admin/users and hands it to the player out of band; the player spends
 * it at /reset-password. The raw token lives only in that one response:
 * storage keeps a SHA-256 hash, mirroring how passwords are treated.
 */

export const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** better-auth's default credential provider id for email and password accounts. */
const CREDENTIAL_PROVIDER = 'credential';

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

async function hashWithBetterAuth(password: string): Promise<string> {
	const context = await auth.$context;
	return context.password.hash(password);
}

/**
 * Mints a single-use reset token for one user. Returns the raw token for the
 * admin to relay; it cannot be recovered later.
 */
export async function issuePasswordResetToken(
	userId: string,
	createdBy: string
): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
	await db.insert(passwordResetTokens).values({
		userId,
		createdBy,
		tokenHash: hashToken(token),
		expiresAt
	});
	return { token, expiresAt };
}

// Outcomes the reset page turns into messages:
// 'ok': password swapped, sessions ended.
// 'invalid-token': unknown token, already used, or expired.
// 'no-password-account': the account has no password to reset (SSO-only).
export type PasswordResetOutcome = 'ok' | 'invalid-token' | 'no-password-account';

/**
 * Spends a reset token: claims it atomically so two concurrent uses cannot
 * both win, hashes the new password through better-auth's own hasher, and
 * signs the user out everywhere. Falls back to 'invalid-token' when the
 * claim was lost to a concurrent request.
 */
export async function applyPasswordReset(
	token: string,
	newPassword: string,
	hashPassword: (password: string) => Promise<string> = hashWithBetterAuth
): Promise<PasswordResetOutcome> {
	const candidates = await db
		.select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
		.from(passwordResetTokens)
		.where(
			and(
				eq(passwordResetTokens.tokenHash, hashToken(token)),
				isNull(passwordResetTokens.usedAt),
				gt(passwordResetTokens.expiresAt, new Date())
			)
		)
		.limit(1);
	if (candidates.length === 0) return 'invalid-token';
	const row = candidates[0];

	const accounts = await db
		.select({ id: oauthAccounts.id })
		.from(oauthAccounts)
		.where(
			and(eq(oauthAccounts.userId, row.userId), eq(oauthAccounts.providerId, CREDENTIAL_PROVIDER))
		)
		.limit(1);
	if (accounts.length === 0) return 'no-password-account';

	// Single-use claim. The conditional update settles races between two
	// concurrent submissions of the same link.
	const claimed = await db
		.update(passwordResetTokens)
		.set({ usedAt: new Date() })
		.where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
		.returning({ userId: passwordResetTokens.userId });
	if (claimed.length === 0) return 'invalid-token';

	const passwordHash = await hashPassword(newPassword);
	await db
		.update(oauthAccounts)
		.set({ password: passwordHash, updatedAt: new Date() })
		.where(eq(oauthAccounts.id, accounts[0].id));
	await db.delete(sessions).where(eq(sessions.userId, row.userId));
	return 'ok';
}
