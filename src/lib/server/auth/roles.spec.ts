import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Role permission predicates and the admin-existence gate. The pure
 * predicates run directly; the database-backed helpers run against a
 * chainable drizzle mock so no PostgreSQL is needed.
 */

const dbMock = vi.hoisted(() => {
	const chain = {
		select: vi.fn(),
		from: vi.fn(),
		where: vi.fn(),
		limit: vi.fn(),
		update: vi.fn(),
		set: vi.fn(),
		returning: vi.fn()
	};
	for (const step of ['select', 'from', 'where', 'update', 'set']) {
		chain[step as 'select'].mockReturnValue(chain);
	}
	return chain;
});
vi.mock('$lib/server/db', () => ({ db: dbMock }));

import { hasAdmin, isAdminUser, mayCloseGame, mayDeleteChatMessage, promoteToAdmin } from './roles';

afterEach(() => {
	vi.clearAllMocks();
	for (const step of ['select', 'from', 'where', 'update', 'set']) {
		dbMock[step as 'select'].mockReturnValue(dbMock);
	}
});

describe('mayCloseGame', () => {
	it('allows administrators only', () => {
		expect(mayCloseGame({ id: 'mod-1', role: 'admin' })).toBe(true);
		expect(mayCloseGame({ id: 'u-1', role: 'user' })).toBe(false);
		expect(mayCloseGame(null)).toBe(false);
	});
});

describe('mayDeleteChatMessage', () => {
	it('lets authors delete their own messages', () => {
		expect(mayDeleteChatMessage({ id: 'a-1', role: 'user' }, 'a-1')).toBe(true);
	});

	it("lets administrators delete anyone's messages", () => {
		expect(mayDeleteChatMessage({ id: 'mod-1', role: 'admin' }, 'a-1')).toBe(true);
		expect(mayDeleteChatMessage({ id: 'mod-1', role: 'admin' }, 'mod-1')).toBe(true);
	});

	it('denies everyone else and signed-out callers', () => {
		expect(mayDeleteChatMessage({ id: 'other-1', role: 'user' }, 'a-1')).toBe(false);
		expect(mayDeleteChatMessage(null, 'a-1')).toBe(false);
	});
});

describe('hasAdmin', () => {
	it('is true when an admin row exists', async () => {
		dbMock.limit.mockResolvedValueOnce([{ id: 'mod-1' }]);
		await expect(hasAdmin()).resolves.toBe(true);
	});

	it('is false while no admin exists', async () => {
		dbMock.limit.mockResolvedValueOnce([]);
		await expect(hasAdmin()).resolves.toBe(false);
	});
});

describe('isAdminUser', () => {
	it('looks up the stored role live', async () => {
		dbMock.limit.mockResolvedValueOnce([{ role: 'admin' }]);
		await expect(isAdminUser('mod-1')).resolves.toBe(true);

		dbMock.limit.mockResolvedValueOnce([{ role: 'user' }]);
		await expect(isAdminUser('u-1')).resolves.toBe(false);
	});

	it('rejects anonymous callers without touching the database', async () => {
		await expect(isAdminUser(null)).resolves.toBe(false);
		await expect(isAdminUser(undefined)).resolves.toBe(false);
		expect(dbMock.select).not.toHaveBeenCalled();
	});
});

describe('promoteToAdmin', () => {
	it('claims the promotion when no admin exists yet', async () => {
		dbMock.returning.mockResolvedValueOnce([{ id: 'new-admin' }]);
		await expect(promoteToAdmin('new-admin')).resolves.toBe(true);
	});

	it('loses cleanly when another admin already exists', async () => {
		dbMock.returning.mockResolvedValueOnce([]);
		await expect(promoteToAdmin('late-comer')).resolves.toBe(false);
	});
});
