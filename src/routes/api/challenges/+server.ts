import { json } from '@sveltejs/kit';

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
		action: 'create' | 'accept' | 'quickpair' | 'leave-pool';
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

	if (body.action === 'create') {
		const created = await createChallenge({
			userId: locals.user.id,
			variant,
			speedClass: speed,
			rated: !!body.rated,
			colorChoice: (body.colorChoice as 'random' | 'white' | 'black') ?? 'random',
			days: body.days
		});
		return json({ ok: true, challengeId: created.id, challengeToken: created.token });
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
