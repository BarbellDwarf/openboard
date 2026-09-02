import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Container healthcheck target. */
export const GET: RequestHandler = () => json({ ok: true });
