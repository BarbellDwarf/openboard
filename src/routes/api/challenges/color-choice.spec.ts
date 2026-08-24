import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Boundary tests for the challenge-create endpoint's parameter enums,
 * chiefly colorChoice: absent means "caller has no preference", anything
 * outside random/white/black is a bad parameter and must be rejected
 * before any write happens.
 */

const dbMock = vi.hoisted(() => ({
	db: {
		insert: () => ({ values: async () => {} })
	}
}));
vi.mock('$lib/server/db', () => dbMock);

const matchmakingMock = vi.hoisted(() => ({
	createChallenge: vi.fn(),
	acceptChallenge: vi.fn(),
	joinQuickPair: vi.fn(),
	leaveQuickPair: vi.fn(),
	listOpenChallenges: vi.fn()
}));
vi.mock('$lib/server/matchmaking', () => matchmakingMock);

const gameServiceMock = vi.hoisted(() => ({
	createGame: vi.fn()
}));
vi.mock('$lib/server/chess/game-service', () => gameServiceMock);

import { POST } from './+server';

type PostEvent = Parameters<typeof POST>[0];

function postEvent(body: unknown): PostEvent {
	return {
		request: new Request('http://localhost/api/challenges', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { user: { id: '11111111-1111-1111-1111-111111111111' } }
	} as unknown as PostEvent;
}

beforeEach(() => {
	gameServiceMock.createGame.mockReset();
	gameServiceMock.createGame.mockResolvedValue('game-new');
	matchmakingMock.createChallenge.mockReset();
	matchmakingMock.createChallenge.mockResolvedValue({ id: 'ch-1', token: 'tok' });
});

describe('colorChoice validation', () => {
	it('rejects values outside the enum before any write', async () => {
		const res = await POST(
			postEvent({
				action: 'create-solo',
				variant: 'standard',
				speedClass: 'blitz',
				colorChoice: 'purple'
			})
		);
		expect(res.status).toBe(422);
		await expect(res.json()).resolves.toEqual({ ok: false, reason: 'bad-params' });
		expect(gameServiceMock.createGame).not.toHaveBeenCalled();
	});

	it('rejects wrong casing instead of silently coercing it', async () => {
		const res = await POST(
			postEvent({
				action: 'create-solo',
				variant: 'standard',
				speedClass: 'blitz',
				colorChoice: 'Black'
			})
		);
		expect(res.status).toBe(422);
		expect(gameServiceMock.createGame).not.toHaveBeenCalled();
	});

	it.each(['random', 'white', 'black', undefined])(
		'accepts %s through to solo game creation',
		async (colorChoice) => {
			const res = await POST(
				postEvent({ action: 'create-solo', variant: 'standard', speedClass: 'blitz', colorChoice })
			);
			expect(res.status).toBe(200);
			await expect(res.json()).resolves.toEqual({ ok: true, gameId: 'game-new' });
		}
	);

	it('guards the human-challenge create action with the same enum', async () => {
		const rejected = await POST(
			postEvent({ action: 'create', variant: 'standard', speedClass: 'blitz', colorChoice: 'both' })
		);
		expect(rejected.status).toBe(422);
		expect(matchmakingMock.createChallenge).not.toHaveBeenCalled();

		const accepted = await POST(
			postEvent({
				action: 'create',
				variant: 'standard',
				speedClass: 'blitz',
				colorChoice: 'black'
			})
		);
		expect(accepted.status).toBe(200);
		expect(matchmakingMock.createChallenge).toHaveBeenCalledWith(
			expect.objectContaining({ colorChoice: 'black' })
		);
	});
});
