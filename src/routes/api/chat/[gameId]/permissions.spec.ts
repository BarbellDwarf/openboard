import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Exercises the chat endpoint's delete branch against mocked persistence so
 * the admin bypass on soft-delete stays provable without PostgreSQL.
 */

const chatMock = vi.hoisted(() => ({
	historyFor: vi.fn(async () => []),
	addMessage: vi.fn(async () => 1),
	softDelete: vi.fn(async () => true)
}));
vi.mock('$lib/server/chat', () => chatMock);

const gameServiceMock = vi.hoisted(() => ({
	playerColorFor: vi.fn(async () => null),
	loadGame: vi.fn(async () => null),
	completeGame: vi.fn(async () => true),
	createGame: vi.fn(async () => 'g'),
	persistMove: vi.fn()
}));
vi.mock('$lib/server/chess/game-service', () => gameServiceMock);

const rolesMock = vi.hoisted(() => ({
	isAdminUser: vi.fn(async () => false),
	hasAdmin: vi.fn(async () => true),
	promoteToAdmin: vi.fn(async () => false),
	mayCloseGame: vi.fn(() => false),
	mayDeleteChatMessage: vi.fn(() => false)
}));
vi.mock('$lib/server/auth/roles', () => rolesMock);

import { POST } from './+server';

type PostEvent = Parameters<typeof POST>[0];

function postEvent(payload: unknown, user: { id: string } | null): PostEvent {
	return {
		params: { gameId: 'game-1' },
		request: new Request('https://openboard.example.com/api/chat/game-1', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}),
		locals: { user }
	} as unknown as PostEvent;
}

async function postJson(
	payload: unknown,
	user: { id: string } | null
): Promise<Record<string, unknown>> {
	const res = await POST(postEvent(payload, user));
	return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
	vi.clearAllMocks();
	chatMock.softDelete.mockResolvedValue(true);
	rolesMock.isAdminUser.mockImplementation(async () => false);
});

describe('chat message deletion permissions', () => {
	it('sends an administrator bypass for admin deletions', async () => {
		rolesMock.isAdminUser.mockResolvedValue(true);

		const body = await postJson({ deleteId: 7 }, { id: 'mod-1' });

		expect(rolesMock.isAdminUser).toHaveBeenCalledWith('mod-1');
		expect(chatMock.softDelete).toHaveBeenCalledWith(7, 'mod-1', { admin: true });
		expect(body.ok).toBe(true);
	});

	it('keeps author deletion working without any bypass', async () => {
		const body = await postJson({ deleteId: 7 }, { id: 'author-1' });

		expect(rolesMock.isAdminUser).toHaveBeenCalledWith('author-1');
		expect(chatMock.softDelete).toHaveBeenCalledWith(7, 'author-1', { admin: false });
		expect(body.ok).toBe(true);
	});

	it("denies a non-admin deleting someone else's message", async () => {
		chatMock.softDelete.mockResolvedValue(false);

		const body = await postJson({ deleteId: 9 }, { id: 'random-user' });

		expect(chatMock.softDelete).toHaveBeenCalledWith(9, 'random-user', { admin: false });
		expect(body.ok).toBe(false);
	});

	it('still requires a signed-in caller', async () => {
		const res = await POST(postEvent({ deleteId: 7 }, null));
		expect(res.status).toBe(401);
		expect(chatMock.softDelete).not.toHaveBeenCalled();
	});
});
