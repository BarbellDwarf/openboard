import { json } from '@sveltejs/kit';

import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/** Sign out. The session row is removed, so every device token dies with it. */
export const POST: RequestHandler = async ({ request }) => {
	const response = await auth.api.signOut({ headers: request.headers });
	return json({ success: response.success });
};
