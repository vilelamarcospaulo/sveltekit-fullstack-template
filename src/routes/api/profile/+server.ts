// GET-only by design — writes go through profile/+page.server.ts's form
// action, not a client-side PUT.
//
// event.locals.user is already populated by hooks.server.ts — no need to
// call getSession() again here.
import { getDb } from '$lib/server/db';
import { getProfile } from '$lib/internal/use_case/profile';
import type { ApiErrorBody } from '$lib/types/api';
import type { RequestHandler } from './$types';

function unauthorized(): Response {
	return Response.json({ errors: { _auth: 'Authentication required.' } } satisfies ApiErrorBody, {
		status: 401
	});
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) return unauthorized();

	const db = getDb(platform);
	const view = await getProfile(db, locals.user.id);
	if (!view) return unauthorized();

	return Response.json(view);
};
