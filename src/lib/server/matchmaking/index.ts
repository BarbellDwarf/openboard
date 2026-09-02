import { randomBytes } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { challenges, games, gamePlayers, ratings, users } from '$lib/server/db/schema';
import { createGame } from '$lib/server/chess/game-service';
import { notifyUser } from '$lib/server/notifications';
import type { Color, SpeedClass, VariantId } from '$lib/server/chess/types';

/**
 * Challenge creation and acceptance, plus an in-memory quick-pair pool.
 * The pool lives in this process; single-replica deployment keeps that safe.
 */

export interface TimeControlPreset {
	initialMs: number | null;
	incrementMs: number | null;
	daysPerMove: number | null;
}

export type LobbySpeed = SpeedClass | 'correspondence';

export const PRESETS: Record<LobbySpeed, TimeControlPreset> = {
	bullet: { initialMs: 60_000, incrementMs: 0, daysPerMove: null },
	blitz: { initialMs: 300_000, incrementMs: 2_000, daysPerMove: null },
	rapid: { initialMs: 600_000, incrementMs: 10_000, daysPerMove: null },
	classical: { initialMs: 1_800_000, incrementMs: 30_000, daysPerMove: null },
	correspondence: { initialMs: null, incrementMs: null, daysPerMove: 3 }
};

export async function createChallenge(input: {
	userId: string;
	variant: VariantId;
	speedClass: LobbySpeed;
	rated: boolean;
	colorChoice: 'random' | 'white' | 'black';
	days?: number;
}): Promise<{ id: string; token: string }> {
	const preset = PRESETS[input.speedClass];
	const tc: TimeControlPreset =
		input.speedClass === 'correspondence' ? { ...preset, daysPerMove: input.days ?? 3 } : preset;

	const token = randomBytes(12).toString('base64url');
	const [row] = await db
		.insert(challenges)
		.values({
			challengerId: input.userId,
			token,
			variant: input.variant,
			rated: input.rated,
			initialMs: tc.initialMs,
			incrementMs: tc.incrementMs,
			daysPerMove: tc.daysPerMove,
			colorChoice: input.colorChoice,
			speedClass: input.speedClass,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
		})
		.returning({ id: challenges.id, token: challenges.token });
	return { id: row.id, token: row.token };
}

/** Look up a shareable-token challenge for the accept screen. */
export async function challengeByToken(token: string) {
	const [row] = await db
		.select({
			id: challenges.id,
			variant: challenges.variant,
			speedClass: challenges.speedClass,
			rated: challenges.rated,
			initialMs: challenges.initialMs,
			incrementMs: challenges.incrementMs,
			daysPerMove: challenges.daysPerMove,
			colorChoice: challenges.colorChoice,
			status: challenges.status,
			expiresAt: challenges.expiresAt,
			challengerId: challenges.challengerId,
			challengerName: users.name
		})
		.from(challenges)
		.innerJoin(users, eq(users.id, challenges.challengerId))
		.where(eq(challenges.token, token))
		.limit(1);
	return row ?? null;
}

export async function listOpenChallenges() {
	return db
		.select({
			id: challenges.id,
			variant: challenges.variant,
			speedClass: challenges.speedClass,
			rated: challenges.rated,
			initialMs: challenges.initialMs,
			incrementMs: challenges.incrementMs,
			daysPerMove: challenges.daysPerMove,
			colorChoice: challenges.colorChoice
		})
		.from(challenges)
		.where(and(eq(challenges.status, 'open'), gt(challenges.expiresAt, new Date())));
}

export async function acceptChallenge(
	challengeId: string,
	userId: string
): Promise<{ ok: boolean; gameId?: string }> {
	// Cheap pre-check so the common self-accept case never claims anything.
	const [existing] = await db
		.select({ challengerId: challenges.challengerId })
		.from(challenges)
		.where(eq(challenges.id, challengeId))
		.limit(1);
	if (!existing) return { ok: false };
	if (existing.challengerId === userId) return { ok: false };

	// Claim the challenge atomically: only one accepter can flip status.
	const claimed = await db
		.update(challenges)
		.set({ status: 'accepted' })
		.where(and(eq(challenges.id, challengeId), eq(challenges.status, 'open')))
		.returning();
	const challenge = claimed[0];
	if (!challenge) return { ok: false };
	if (challenge.challengerId === userId) {
		await db.update(challenges).set({ status: 'open' }).where(eq(challenges.id, challengeId));
		return { ok: false };
	}

	let whiteId: string | null;
	let blackId: string | null;
	const choice = Math.random();
	if (challenge.colorChoice === 'white') {
		whiteId = challenge.challengerId;
		blackId = userId;
	} else if (challenge.colorChoice === 'black') {
		whiteId = userId;
		blackId = challenge.challengerId;
	} else if (choice < 0.5) {
		whiteId = challenge.challengerId;
		blackId = userId;
	} else {
		whiteId = userId;
		blackId = challenge.challengerId;
	}

	const gameId = await createGame({
		variant: challenge.variant as VariantId,
		rated: challenge.rated,
		timeControl: {
			initialMs: challenge.initialMs,
			incrementMs: challenge.incrementMs,
			daysPerMove: challenge.daysPerMove
		},
		whiteId,
		blackId
	});

	await db.update(challenges).set({ gameId }).where(eq(challenges.id, challengeId));
	if (challenge.challengerId) {
		void notifyUser(challenge.challengerId, 'challenge-accepted', {
			body: 'Your challenge was accepted.',
			url: `/game/${gameId}`
		});
	}
	await db.insert(gamePlayers).values([
		{ gameId, userId: whiteId, color: 'white' as Color },
		{ gameId, userId: blackId, color: 'black' as Color }
	]);
	await db.update(games).set({ status: 'started' }).where(eq(games.id, gameId));

	void db
		.update(challenges)
		.set({ status: 'expired' })
		.where(and(eq(challenges.status, 'open'), eq(challenges.challengerId, '')));

	return { ok: true, gameId };
}

export interface PoolEntry {
	userId: string;
	speedClass: LobbySpeed;
	variant: VariantId;
	rated: boolean;
	since: number;
}

const BASE_BAND = 100;
const BAND_STEP_MS = 5_000;
const BAND_STEP = 100;
const MAX_BAND = 800;

/** Widening search band: 100 at join, +100 every 5 s, capped at 800. */
export function bandFor(waitedMs: number): number {
	return Math.min(
		BASE_BAND + Math.floor(Math.max(0, waitedMs) / BAND_STEP_MS) * BAND_STEP,
		MAX_BAND
	);
}

/**
 * Pure pairing decision so the rules stay unit-testable: identical speed,
 * variant and rated flag, plus a rating gap inside the waiting side's
 * (widening) band. Missing ratings count as the 1500 starting rating.
 */
export function pairCompatible(
	entry: PoolEntry,
	incoming: { speedClass: LobbySpeed; variant: VariantId; rated: boolean },
	ratingOf: (who: 'entry' | 'incoming') => number | null,
	nowMs: number
): boolean {
	if (entry.speedClass !== incoming.speedClass) return false;
	if (entry.variant !== incoming.variant) return false;
	if (entry.rated !== incoming.rated) return false;
	const a = ratingOf('entry') ?? 1500;
	const b = ratingOf('incoming') ?? 1500;
	return Math.abs(a - b) <= bandFor(nowMs - entry.since);
}

const quickPairPool = new Map<string, PoolEntry>();
const waitingResolvers = new Map<string, (gameId: string) => void>();

export function leaveQuickPair(userId: string): void {
	quickPairPool.delete(userId);
	waitingResolvers.delete(userId);
}

/** Rating used when a player has no row yet: the Glicko-2 start value. */
async function ratingForSpeed(
	userId: string,
	variant: VariantId,
	speedClass: LobbySpeed
): Promise<number | null> {
	if (speedClass === 'correspondence') return null;
	const [row] = await db
		.select({ rating: ratings.rating })
		.from(ratings)
		.where(
			and(
				eq(ratings.userId, userId),
				eq(ratings.variant, variant),
				eq(ratings.speedClass, speedClass)
			)
		)
		.limit(1);
	return row?.rating ?? null;
}

/** Join the pool; resolves with a game id once a partner is matched. */
export async function joinQuickPair(
	userId: string,
	speedClass: LobbySpeed,
	variant: VariantId,
	rated: boolean,
	signal?: AbortSignal
): Promise<{ gameId: string | null }> {
	if (waitingResolvers.has(userId)) return { gameId: null };
	leaveQuickPair(userId);

	if (signal?.aborted) return { gameId: null };
	const onAbort = () => leaveQuickPair(userId);
	signal?.addEventListener('abort', onAbort, { once: true });

	try {
		for (const [otherId, entry] of quickPairPool.entries()) {
			if (entry.userId === userId) continue;
			const mine = await ratingForSpeed(
				userId,
				variant,
				speedClass === 'correspondence' ? 'classical' : speedClass
			);
			const theirs = await ratingForSpeed(
				entry.userId,
				variant,
				entry.speedClass === 'correspondence' ? 'classical' : entry.speedClass
			);
			const ratingOf = (id: string): number | null => (id === userId ? mine : theirs);
			if (!pairCompatible(entry, { speedClass, variant, rated }, ratingOf, Date.now())) continue;
			quickPairPool.delete(otherId);
			const resolver = waitingResolvers.get(entry.userId);
			waitingResolvers.delete(entry.userId);
			const whiteFirst = Math.random() < 0.5;
			const gameId = await createGame({
				variant,
				rated,
				timeControl: PRESETS[speedClass],
				whiteId: whiteFirst ? entry.userId : userId,
				blackId: whiteFirst ? userId : entry.userId
			});
			await db.insert(gamePlayers).values([
				{ gameId, userId: whiteFirst ? entry.userId : userId, color: 'white' as Color },
				{ gameId, userId: whiteFirst ? userId : entry.userId, color: 'black' as Color }
			]);
			await db.update(games).set({ status: 'started' }).where(eq(games.id, gameId));
			signal?.removeEventListener('abort', onAbort);
			resolver?.(gameId);
			return { gameId };
		}
	} finally {
		if (signal?.aborted && quickPairPool.has(userId)) leaveQuickPair(userId);
	}

	if (signal?.aborted) return { gameId: null };

	quickPairPool.set(userId, { userId, speedClass, variant, rated, since: Date.now() });
	return new Promise((resolvePromise) => {
		waitingResolvers.set(userId, (gid) => resolvePromise({ gameId: gid }));
	});
}
