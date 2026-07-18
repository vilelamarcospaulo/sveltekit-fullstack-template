// The SvelteKit counterpart to the Next.js sibling template's
// src/app/api/profile/route.ts Route Handler — see CLAUDE.md's Next→SvelteKit
// mapping table ("Route Handler → +server.ts"). Exists specifically as a
// worked example of that pattern: src/routes/profile's own edit form saves
// via a SvelteKit form action (the idiomatic, progressively-enhanced path —
// see +page.server.ts); this JSON API is a second, read-only way to fetch
// the same data, demonstrated live via
// src/lib/components/profile-api-demo.svelte on the profile page. GET-only
// by design — writes go through the form action, not a client-side PUT.
//
// Auth: event.locals.user is already populated by src/hooks.server.ts for
// every request, including +server.ts handlers — no need to call
// getAuth(...).api.getSession(...) again here.
import { getDb } from '$lib/server/db';
import { getProfile } from '$lib/internal/use_case/profile';
import type { ApiErrorBody } from '$lib/types/api';
import type { RequestHandler } from './$types';

function unauthorized(): Response {
	return Response.json({ errors: { _auth: 'Authentication required.' } } satisfies ApiErrorBody, {
		status: 401
	});
}

// GET /api/profile — the signed-in user's own profile (incl. email for display).
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) return unauthorized();

	const db = getDb(platform);
	const view = await getProfile(db, locals.user.id);
	if (!view) return unauthorized();

	return Response.json(view);
};
