// Builds a fresh better-auth instance on every call — deliberately not
// cached as a module-level singleton. betterAuth() captures a concrete
// Drizzle client at construction time, and a cached singleton would keep
// reusing that one client's underlying "postgres" socket across every
// request in the isolate — the same cross-request I/O reuse bug fixed in
// src/lib/server/db/index.ts, just one level up. Call from request-scoped
// code (hooks.server.ts, a form action, or a `+server.ts` handler) only.
//
// `platform` threads SvelteKit's Cloudflare bindings through to getDb() —
// see db/index.ts for why this can't be resolved via a context-free helper
// the way Next's getCloudflareContext() can.
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { getEnv } from '$lib/server/env';

export function getAuth(platform?: App.Platform) {
	const authEnv = getEnv();

	return betterAuth({
		baseURL: authEnv.ORIGIN,
		secret: authEnv.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(platform), { provider: 'pg', schema }),

		// Derive the trusted origin from the canonical app URL so better-auth's
		// CSRF / origin-check middleware accepts requests originating from this
		// host.
		trustedOrigins: [new URL(authEnv.ORIGIN).origin],

		socialProviders: {
			google: {
				clientId: authEnv.GOOGLE_CLIENT_ID,
				clientSecret: authEnv.GOOGLE_CLIENT_SECRET
			}
		},

		// Rate limiting is explicitly disabled for now: better-auth's built-in
		// "memory" storage is a per-process counter, which doesn't work across
		// Cloudflare Workers isolates (many short-lived, concurrent isolates, no
		// shared memory between them) — leaving it enabled with "memory" storage
		// wouldn't actually rate-limit anything in production, just silently
		// pretend to. Revisit with a durable store (Workers KV or D1) backing it
		// in a later phase.
		rateLimit: {
			enabled: false
		},

		plugins: [
			sveltekitCookies(getRequestEvent) // must stay last in the array
		]
	});
}
