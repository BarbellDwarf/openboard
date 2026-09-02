import { describe, expect, it } from 'vitest';

import {
	bandFor,
	challengeClaimable,
	pairCompatible,
	POOL_ENTRY_TTL_MS,
	type PoolEntry
} from './index';

const entry = (over: Partial<PoolEntry> = {}): PoolEntry => ({
	userId: 'waiting-user',
	speedClass: 'blitz',
	variant: 'standard',
	rated: true,
	since: 0,
	...over
});

describe('quick-pair compatibility', () => {
	it('pairs identical preferences', () => {
		const ok = pairCompatible(
			entry(),
			{ speedClass: 'blitz', variant: 'standard', rated: true },
			() => 1500,
			0
		);
		expect(ok).toBe(true);
	});

	it("keeps the first queuer's variant and rated choice", () => {
		const chess960 = pairCompatible(
			entry({ variant: 'chess960' }),
			{ speedClass: 'blitz', variant: 'standard', rated: true },
			() => 1500,
			0
		);
		const unrated = pairCompatible(
			entry({ rated: false }),
			{ speedClass: 'blitz', variant: 'standard', rated: true },
			() => 1500,
			0
		);
		expect(chess960).toBe(false);
		expect(unrated).toBe(false);
	});

	it('separates different speed classes', () => {
		const ok = pairCompatible(
			entry({ speedClass: 'bullet' }),
			{ speedClass: 'blitz', variant: 'standard', rated: true },
			() => 1500,
			0
		);
		expect(ok).toBe(false);
	});

	it('rejects rating gaps outside the initial band', () => {
		const ok = pairCompatible(
			entry(),
			{ speedClass: 'blitz', variant: 'standard', rated: true },
			(who) => (who === 'entry' ? 1500 : 1700),
			0
		);
		expect(ok).toBe(false);
	});

	it('widens the band until distant ratings pair', () => {
		const far = (who: string): number => (who === 'entry' ? 1500 : 1650);
		expect(
			pairCompatible(entry(), { speedClass: 'blitz', variant: 'standard', rated: true }, far, 0)
		).toBe(false);
		// After 30 s the band is 100 + 6*100 = 700.
		expect(
			pairCompatible(
				entry(),
				{ speedClass: 'blitz', variant: 'standard', rated: true },
				far,
				30_000
			)
		).toBe(true);
	});

	it('caps the widening at 800', () => {
		expect(bandFor(3_600_000)).toBe(800);
	});

	it('treats missing ratings as the 1500 start value', () => {
		const ok = pairCompatible(
			entry(),
			{ speedClass: 'blitz', variant: 'standard', rated: true },
			() => null,
			0
		);
		expect(ok).toBe(true);
	});

	it('ignores pool entries past the TTL', () => {
		const prefs = { speedClass: 'blitz', variant: 'standard', rated: true } as const;
		expect(pairCompatible(entry(), prefs, () => 1500, POOL_ENTRY_TTL_MS)).toBe(true);
		expect(pairCompatible(entry(), prefs, () => 1500, POOL_ENTRY_TTL_MS + 1)).toBe(false);
	});
});

describe('challenge claimability', () => {
	const expiry = new Date(10_000);

	it('accepts an open challenge that has not expired', () => {
		expect(challengeClaimable({ status: 'open', expiresAt: expiry }, new Date(9_999))).toBe(true);
	});

	it('rejects a claim after expiry', () => {
		expect(challengeClaimable({ status: 'open', expiresAt: expiry }, new Date(10_000))).toBe(false);
		expect(challengeClaimable({ status: 'open', expiresAt: expiry }, new Date(20_000))).toBe(false);
	});

	it('rejects anything that is no longer open', () => {
		expect(challengeClaimable({ status: 'accepted', expiresAt: expiry }, new Date(0))).toBe(false);
		expect(challengeClaimable({ status: 'expired', expiresAt: expiry }, new Date(0))).toBe(false);
	});
});
