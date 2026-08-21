import { randomBytes } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { challenges, games, gamePlayers } from '$lib/server/db/schema';
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
}): Promise<string> {
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
		.returning({ id: challenges.id });
	return row.id;
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
	const [challenge] = await db
		.select()
		.from(challenges)
		.where(and(eq(challenges.id, challengeId), eq(challenges.status, 'open')))
		.limit(1);
	if (!challenge) return { ok: false };
	if (challenge.challengerId === userId) return { ok: false };

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

	await db
		.update(challenges)
		.set({ status: 'accepted', gameId })
		.where(eq(challenges.id, challengeId));
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

interface PoolEntry {
	userId: string;
	speedClass: LobbySpeed;
	since: number;
}

const quickPairPool = new Map<string, PoolEntry>();
const waitingResolvers = new Map<string, (gameId: string) => void>();

export function leaveQuickPair(userId: string): void {
	quickPairPool.delete(userId);
	waitingResolvers.delete(userId);
}

/** Join the pool; resolves with a game id once a partner is matched. */
export async function joinQuickPair(
	userId: string,
	speedClass: LobbySpeed,
	variant: VariantId,
	rated: boolean
): Promise<{ gameId: string | null }> {
	if (waitingResolvers.has(userId)) return { gameId: null };
	leaveQuickPair(userId);

	for (const [otherId, entry] of quickPairPool.entries()) {
		if (entry.userId === userId) continue;
		if (entry.speedClass !== speedClass) continue;
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
		resolver?.(gameId);
		return { gameId };
	}

	quickPairPool.set(userId, { userId, speedClass, since: Date.now() });
	return new Promise((resolvePromise) => {
		waitingResolvers.set(userId, (gid) => resolvePromise({ gameId: gid }));
	});
}
