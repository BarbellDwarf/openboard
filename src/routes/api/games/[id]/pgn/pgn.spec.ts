import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Access rules for the PGN download, exercised against a mocked database:
 * seated players may export at any point in the game's life, everyone else
 * only once the game is finished. Unknown and malformed ids answer 404.
 */

const dbMock = vi.hoisted(() => {
	const state = { rows: [] as unknown[] };
	const limit = vi.fn(async () => state.rows);
	const db = {
		select: () => ({
			from: () => ({
				where: () => ({ limit })
			})
		})
	};
	return { db, state, limit };
});
vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

import { GET } from './+server';

type GetEvent = Parameters<typeof GET>[0];

const GAME_ID = '0b8f6c1e-1111-4222-8333-444455556666';
const PGN = '[Event "OpenBoard rated game"]\n\n1. e4 e5 1-0\n';

function getEvent(userId: string | null): GetEvent {
	return {
		params: { id: GAME_ID },
		request: new Request(`https://openboard.example.com/api/games/${GAME_ID}/pgn`),
		locals: { user: userId ? { id: userId } : null }
	} as unknown as GetEvent;
}

function storedGame(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
	return {
		status: 'started',
		pgn: PGN,
		whiteId: 'white-player',
		blackId: 'black-player',
		...overrides
	};
}

beforeEach(() => {
	dbMock.state.rows = [];
	dbMock.limit.mockClear();
});

describe('GET /api/games/[id]/pgn access rules', () => {
	it('lets a seated player download while the game is still running', async () => {
		dbMock.state.rows = [storedGame()];

		const res = await GET(getEvent('white-player'));

		expect(res.status).toBe(200);
		expect(await res.text()).toBe(PGN);
	});

	it('lets the other seat download too', async () => {
		dbMock.state.rows = [storedGame({ status: 'created' })];

		const res = await GET(getEvent('black-player'));

		expect(res.status).toBe(200);
	});

	it('answers anyone at all once the game is finished', async () => {
		dbMock.state.rows = [storedGame({ status: 'finished' })];

		for (const user of [null, 'spectator']) {
			const res = await GET(getEvent(user));
			expect(res.status).toBe(200);
		}
	});

	it('keeps running games private from non-participants', async () => {
		dbMock.state.rows = [storedGame()];

		const anonymous = await GET(getEvent(null));
		const bystander = await GET(getEvent('just-watching'));

		expect(anonymous.status).toBe(403);
		expect(bystander.status).toBe(403);
	});

	it('answers 404 for an unknown game', async () => {
		dbMock.state.rows = [];

		const res = await GET(getEvent('someone'));

		expect(res.status).toBe(404);
	});

	it('answers 404 for a malformed id without querying the database', async () => {
		const event = { ...getEvent(null), params: { id: '../../etc/passwd' } } as unknown as GetEvent;

		const res = await GET(event);

		expect(res.status).toBe(404);
		expect(dbMock.limit).not.toHaveBeenCalled();
	});

	it('answers 404 when no move has been stored yet', async () => {
		dbMock.state.rows = [storedGame({ pgn: null })];

		const res = await GET(getEvent('white-player'));

		expect(res.status).toBe(404);
	});
});

describe('GET /api/games/[id]/pgn response shape', () => {
	it('sends the PGN as an attachment named after the game', async () => {
		dbMock.state.rows = [storedGame({ status: 'finished' })];

		const res = await GET(getEvent(null));

		expect(res.headers.get('content-type')).toBe('text/chess; charset=utf-8');
		expect(res.headers.get('content-disposition')).toBe(
			`attachment; filename="openboard-${GAME_ID}.pgn"`
		);
	});
});
