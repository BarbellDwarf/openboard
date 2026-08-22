import { json } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { gamePlayers } from '$lib/server/db/schema';
import { createGame } from '$lib/server/chess/game-service';
import {
	acceptChallenge,
	createChallenge,
	joinQuickPair,
	leaveQuickPair
} from '$lib/server/matchmaking';
import { VARIANTS, type VariantId } from '$lib/server/chess/types';
import type { LobbySpeed } from '$lib/server/matchmaking';
import type { RequestHandler } from './$types';

const SPEEDS = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'] as const;

export const GET: RequestHandler = async () => {
	const { listOpenChallenges } = await import('$lib/server/matchmaking');
	return json({ challenges: await listOpenChallenges() });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as {
		action: 'create' | 'accept' | 'quickpair' | 'leave-pool' | 'create-solo';
		variant?: string;
		speedClass?: string;
		rated?: boolean;
		colorChoice?: string;
		days?: number;
		challengeId?: string;
	};

	const speed = (body.speedClass ?? 'blitz') as LobbySpeed;
	const variant = (body.variant ?? 'standard') as VariantId;
	if (!SPEEDS.includes(speed) || !VARIANTS.includes(variant)) {
		return json({ ok: false, reason: 'bad-params' }, { status: 422 });
	}

	if (body.action === 'create-solo') {
		const presetMap: Record<string, { initialMs: number | null; incrementMs: number | null }> = {
			bullet: { initialMs: 60_000, incrementMs: 0 },
			blitz: { initialMs: 300_000, incrementMs: 2_000 },
			rapid: { initialMs: 600_000, incrementMs: 10_000 },
			classical: { initialMs: 1_800_000, incrementMs: 30_000 }
		};
		const tc = presetMap[speed] ?? { initialMs: null, incrementMs: null };
		const userColor = body.colorChoice === 'black' ? 'black' : 'white';
		const whiteId = userColor === 'white' ? locals.user!.id : null;
		const blackId = userColor === 'black' ? locals.user!.id : null;
		const gameId = await createGame({
			variant,
			rated: false,
			timeControl: { initialMs: tc.initialMs, incrementMs: tc.incrementMs, daysPerMove: null },
			whiteId,
			blackId
		});
		if (userColor === 'white') {
			await db
				.insert(gamePlayers)
				.values({ gameId, userId: locals.user!.id, color: 'white' as never });
		} else {
			await db
				.insert(gamePlayers)
				.values({ gameId, userId: locals.user!.id, color: 'black' as never });
		}
		return json({ ok: true, gameId });
	}

	if (body.action === 'create') {
		const id = await createChallenge({
			userId: locals.user.id,
			variant,
			speedClass: speed,
			rated: !!body.rated,
			colorChoice: (body.colorChoice as 'random' | 'white' | 'black') ?? 'random',
			days: body.days
		});
		return json({ ok: true, challengeId: id });
	}

	if (body.action === 'accept' && body.challengeId) {
		return json(await acceptChallenge(body.challengeId, locals.user.id));
	}

	if (body.action === 'quickpair') {
		return json(await joinQuickPair(locals.user.id, speed, variant, !!body.rated, request.signal));
	}

	if (body.action === 'leave-pool') {
		leaveQuickPair(locals.user.id);
		return json({ ok: true });
	}

	return json({ ok: false }, { status: 400 });
};
