import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { preferences } from '$lib/server/db/schema';
import { BOARD_THEMES, PIECE_SETS, SOUND_PACKS } from '$lib/config/appearance';
import { isKnownBoardFlavor, isValidSoundVolume } from '$lib/server/preferences/validation';
import type { RequestHandler } from './$types';

const THEME_IDS = BOARD_THEMES.map((t) => t.id) as string[];
const PIECE_IDS = PIECE_SETS.map((p) => p.id) as string[];
const SOUND_IDS = SOUND_PACKS.map((s2) => s2.id) as string[];

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const [row] = await db
		.select()
		.from(preferences)
		.where(eq(preferences.userId, locals.user.id))
		.limit(1);
	return json({ ok: true, preferences: row ?? null });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ ok: false }, { status: 401 });
	const body = (await request.json()) as Record<string, unknown>;

	if (body.boardTheme != null && !THEME_IDS.includes(String(body.boardTheme))) {
		return json({ ok: false, reason: 'bad-theme' }, { status: 422 });
	}
	if (body.pieceSet != null && !PIECE_IDS.includes(String(body.pieceSet))) {
		return json({ ok: false, reason: 'bad-piece-set' }, { status: 422 });
	}
	if (body.soundPack != null && !SOUND_IDS.includes(String(body.soundPack))) {
		return json({ ok: false, reason: 'bad-sound-pack' }, { status: 422 });
	}
	if (body.boardFlavor != null && !isKnownBoardFlavor(body.boardFlavor)) {
		return json({ ok: false, reason: 'bad-board-flavor' }, { status: 422 });
	}

	const allowed = [
		'boardTheme',
		'pieceSet',
		'soundPack',
		'soundVolume',
		'animations',
		'coordinates',
		'soundsEnabled',
		'showDests',
		'autoQueen',
		'boardFlavor'
	] as const;
	// Type-check every field so bad payloads 422 instead of hitting Postgres.
	const booleans = [
		'animations',
		'coordinates',
		'soundsEnabled',
		'showDests',
		'autoQueen'
	] as const;
	const patch: Record<string, unknown> = {};
	for (const key of allowed) {
		const value = body[key];
		if (value === undefined) continue;
		if (key === 'soundVolume') {
			if (!isValidSoundVolume(value)) {
				return json({ ok: false, reason: 'bad-sound-volume' }, { status: 422 });
			}
		} else if ((booleans as readonly string[]).includes(key)) {
			if (typeof value !== 'boolean') {
				return json({ ok: false, reason: `bad-${key}` }, { status: 422 });
			}
		} else if (typeof value !== 'string') {
			return json({ ok: false, reason: `bad-${key}` }, { status: 422 });
		}
		patch[key] = value;
	}
	if (Object.keys(patch).length === 0) return json({ ok: false }, { status: 422 });

	await db
		.insert(preferences)
		.values({ userId: locals.user.id, ...patch })
		.onConflictDoUpdate({ target: preferences.userId, set: patch });
	return json({ ok: true });
};
