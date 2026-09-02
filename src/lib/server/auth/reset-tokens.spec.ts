import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Admin-issued reset tokens: the raw value is shown once and never stored,
 * a token works exactly once, expires after a day, and spending it swaps
 * the password through better-auth's hasher and signs the user out.
 */

const authMock = vi.hoisted(() => ({
	auth: {
		$context: vi.fn(async () => ({ password: { hash: async () => 'unused-real-hash' } }))
	}
}));
vi.mock('$lib/server/auth', () => authMock);

const dbMock = vi.hoisted(() => {
	const refs: Record<string, unknown> = {};
	let tokenRows: Array<Record<string, unknown>> = [];
	let accountRows: Array<Record<string, unknown>> = [];
	let claimWins = true;
	const inserts: Array<Record<string, unknown>> = [];
	const updates: Array<{ table: unknown; values: unknown }> = [];
	const deletes: unknown[] = [];

	function rowsFor(table: unknown): Array<Record<string, unknown>> {
		if (table === refs.tokens) return tokenRows;
		if (table === refs.accounts) return accountRows;
		return [];
	}

	const db = {
		select: () => {
			const builder: Record<string, unknown> = {};
			builder.from = (table: unknown) => {
				builder.table = table;
				return builder;
			};
			builder.where = () => builder;
			builder.limit = async () => rowsFor(builder.table);
			return builder;
		},
		insert: () => ({
			values: async (values: Record<string, unknown>) => {
				inserts.push(values);
			}
		}),
		update: (table: unknown) => ({
			set: (values: unknown) => ({
				// Awaitable directly, or chainable through .returning().
				where: () => {
					let consumed = false;
					const consume = () => {
						if (!consumed) {
							consumed = true;
							updates.push({ table, values });
						}
					};
					const chainable = {
						then(onFulfilled: (value: unknown[]) => unknown) {
							consume();
							return Promise.resolve([]).then(onFulfilled);
						},
						returning: async () => {
							consume();
							if (table !== refs.tokens || !claimWins) return [];
							return [{ userId: tokenRows[0]?.userId }];
						}
					};
					return chainable;
				}
			})
		}),
		delete: (table: unknown) => ({
			where: async () => {
				deletes.push(table);
			}
		})
	};

	return {
		db,
		refs,
		setTokenRows(rows: Array<Record<string, unknown>>) {
			tokenRows = rows;
		},
		setAccountRows(rows: Array<Record<string, unknown>>) {
			accountRows = rows;
		},
		setClaimWins(wins: boolean) {
			claimWins = wins;
		},
		inserts,
		updates,
		deletes
	};
});
vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

import type { PgTable } from 'drizzle-orm/pg-core';
import { oauthAccounts, passwordResetTokens, sessions } from '../db/schema';
import { applyPasswordReset, issuePasswordResetToken } from './reset-tokens';

// Resolve table identities lazily for the fake: the hoisted factory above
// runs before imports, so the refs are filled in here instead.
dbMock.refs.tokens = passwordResetTokens as unknown as PgTable;
dbMock.refs.accounts = oauthAccounts as unknown as PgTable;

const fakeHash = vi.fn(async (password: string) => `hash(${password})`);

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.setTokenRows([]);
	dbMock.setAccountRows([]);
	dbMock.setClaimWins(true);
	dbMock.inserts.length = 0;
	dbMock.updates.length = 0;
	dbMock.deletes.length = 0;
});

describe('issuePasswordResetToken', () => {
	it('returns a raw token while storing only its hash and an expiry', async () => {
		const before = Date.now();
		const { token, expiresAt } = await issuePasswordResetToken('user-1', 'admin-1');

		expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
		expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);

		expect(dbMock.inserts).toHaveLength(1);
		const stored = dbMock.inserts[0];
		expect(stored.userId).toBe('user-1');
		expect(stored.createdBy).toBe('admin-1');
		expect(stored.tokenHash).not.toBe(token);
		expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('mints a different token every time', async () => {
		const first = await issuePasswordResetToken('user-1', 'admin-1');
		const second = await issuePasswordResetToken('user-1', 'admin-1');
		expect(first.token).not.toBe(second.token);
	});
});

describe('applyPasswordReset', () => {
	const VALID_ROW = {
		id: 'row-1',
		userId: 'user-1',
		tokenHash: 'sha256-of-real-token'
	};

	it('rejects unknown, used, or expired tokens without touching anything', async () => {
		dbMock.setTokenRows([]);

		await expect(applyPasswordReset('nope', 'new-password-123', fakeHash)).resolves.toBe(
			'invalid-token'
		);
		expect(dbMock.updates).toEqual([]);
		expect(dbMock.deletes).toEqual([]);
	});

	it('swaps the password through the supplied hasher and ends all sessions', async () => {
		dbMock.setTokenRows([VALID_ROW]);
		dbMock.setAccountRows([{ id: 'account-9' }]);

		await expect(applyPasswordReset('real-token', 'brand-new-password', fakeHash)).resolves.toBe(
			'ok'
		);

		expect(fakeHash).toHaveBeenCalledWith('brand-new-password');
		expect(dbMock.updates).toContainEqual({
			table: oauthAccounts,
			values: expect.objectContaining({ password: 'hash(brand-new-password)' })
		});
		expect(dbMock.deletes).toContainEqual(sessions);
	});

	it('reports SSO-only accounts and leaves the token unspent', async () => {
		dbMock.setTokenRows([VALID_ROW]);
		dbMock.setAccountRows([]);

		await expect(applyPasswordReset('real-token', 'brand-new-password', fakeHash)).resolves.toBe(
			'no-password-account'
		);

		expect(dbMock.updates).toEqual([]);
		expect(dbMock.deletes).toEqual([]);
	});

	it('never lets one token set two passwords', async () => {
		dbMock.setTokenRows([VALID_ROW]);
		dbMock.setAccountRows([{ id: 'account-9' }]);
		dbMock.setClaimWins(false);

		await expect(applyPasswordReset('real-token', 'first-password-x', fakeHash)).resolves.toBe(
			'invalid-token'
		);

		expect(fakeHash).not.toHaveBeenCalled();
		const accountUpdates = dbMock.updates.filter((u) => u.table === oauthAccounts);
		expect(accountUpdates).toEqual([]);
	});
});
