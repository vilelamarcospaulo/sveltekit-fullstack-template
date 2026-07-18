import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Runs once per request — the only place event.locals.session/user get
// populated; everything downstream reads event.locals instead of calling
// getSession() again.
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
