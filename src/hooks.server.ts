import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Runs once per request, so this is the one place event.locals.session/user
// get populated — every `load` function, form action, and `+server.ts`
// handler downstream just reads event.locals instead of calling
// getAuth().api.getSession() again itself (no separate cache()-style
// dedup wrapper needed, unlike the Next.js sibling template's
// src/lib/session.ts — SvelteKit's hook model already gives this for free).
const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const auth = getAuth(event.platform);
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
