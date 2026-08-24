import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The health endpoint reports the database through a live SELECT 1 on the
 * shared pool. A failing query must flip both the flag and the status code
 * so orchestrators restart the container instead of trusting it.
 */

const poolMock = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/server/db', () => ({ pool: poolMock }));

import { GET } from './+server';

type GetEvent = Parameters<typeof GET>[0];

function event(): GetEvent {
	return {
		request: new Request('https://openboard.example.com/api/health'),
		locals: { user: null, session: null }
	} as unknown as GetEvent;
}

beforeEach(() => {
	poolMock.query.mockReset();
});

describe('GET /api/health', () => {
	it('answers 200 with an up database when SELECT 1 succeeds', async () => {
		poolMock.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

		const res = await GET(event());
		const body = (await res.json()) as Record<string, unknown>;

		expect(res.status).toBe(200);
		expect(poolMock.query).toHaveBeenCalledWith('SELECT 1');
		expect(body).toMatchObject({ ok: true, db: 'up' });
		expect(typeof body.uptimeSeconds).toBe('number');
		expect(body.uptimeSeconds as number).toBeGreaterThanOrEqual(0);
	});

	it('answers 503 with a down database when SELECT 1 fails', async () => {
		poolMock.query.mockRejectedValue(new Error('connection refused'));

		const res = await GET(event());
		const body = (await res.json()) as Record<string, unknown>;

		expect(res.status).toBe(503);
		expect(poolMock.query).toHaveBeenCalledWith('SELECT 1');
		expect(body).toEqual({ ok: false, db: 'down', uptimeSeconds: expect.any(Number) });
	});
});
