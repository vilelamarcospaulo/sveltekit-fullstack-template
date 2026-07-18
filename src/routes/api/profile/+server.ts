// The SvelteKit counterpart to the Next.js sibling template's
// src/app/api/profile/route.ts Route Handler — see CLAUDE.md's Next→SvelteKit
// mapping table ("Route Handler → +server.ts"). Exists specifically as a
// worked example of that pattern for this CRUD feature: src/routes/profile's
// own edit form still saves via a SvelteKit form action (the idiomatic,
// progressively-enhanced path — see +page.server.ts), but this JSON API is a
// second, equally real way to read/write the same data, demonstrated live via
// src/lib/components/profile-api-demo.svelte on the profile page.
//
// Auth: event.locals.user is already populated by src/hooks.server.ts for
// every request, including +server.ts handlers — no need to call
// getAuth(...).api.getSession(...) again here.
import { getDb } from '$lib/server/db';
import { getProfile, updateProfile } from '$lib/internal/use_case/profile';
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

// PUT /api/profile — validate (never trust the client) and persist. The user
// id comes only from the session, so any id in the body is ignored.
export const PUT: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) return unauthorized();

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return Response.json(
			{ errors: { _body: 'Request body must be valid JSON.' } } satisfies ApiErrorBody,
			{ status: 400 }
		);
	}

	const db = getDb(platform);
	const result = await updateProfile(db, locals.user.id, body);
	if (!result.ok) {
		return Response.json({ errors: result.errors } satisfies ApiErrorBody, { status: 400 });
	}
	return Response.json(result.value);
};
