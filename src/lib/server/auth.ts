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
import { organization } from 'better-auth/plugins';
import { asc, eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { getDb, type DrizzleDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { member } from '$lib/server/db/schema';
import { getEnv } from '$lib/server/env';

// Structural rather than `ReturnType<typeof getAuth>` deliberately: getAuth()
// itself calls createPersonalOrgForUser from inside a databaseHooks callback,
// so tying this to getAuth()'s own return type would be circular.
type OrganizationCapableAuth = {
	api: {
		createOrganization: (input: {
			body: { name: string; slug: string; userId: string };
		}) => Promise<unknown>;
	};
};

// ── Organization databaseHooks, extracted as standalone functions ──────────
//
// Ported from the Next.js sibling template's src/lib/auth.ts
// (createPersonalOrgForUser / defaultActiveOrganization) — see that file for
// the original, more detailed comment trail.

// Auto-creates a personal "workspace" organization for every new signup
// (`databaseHooks.user.create.after`). Deterministic slug (`user.id` is
// already globally unique) avoids any collision/retry logic.
//
// IMPORTANT: `auth.api.createOrganization` is called with NO `headers` key at
// all (not even `headers: new Headers()`). better-auth's create-organization
// route only skips its session check when *both* `ctx.headers` and
// `ctx.request` are falsy (i.e. treats the call as a trusted "system action"
// authenticated by the explicit `userId` in the body instead of a session) —
// see the `!session && (ctx.request || ctx.headers)` guard in
// node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs.
// There is no session yet at this point in the signup flow, so passing any
// headers here makes that guard throw UNAUTHORIZED. Don't "fix" this later by
// adding a headers object.
export async function createPersonalOrgForUser(
	auth: OrganizationCapableAuth,
	user: { id: string; name: string }
): Promise<void> {
	await auth.api.createOrganization({
		body: {
			name: `${user.name}'s workspace`,
			slug: `user-${user.id}`,
			userId: user.id
		}
	});
}

// Defaults a brand-new session's activeOrganizationId to the user's earliest
// membership (`databaseHooks.session.create.before`). createPersonalOrgForUser
// above ran with no session, so it couldn't call setActiveOrganization itself
// — this backfills the first real session created after signup. A no-op
// (returns undefined) once a session already carries an active org, or if the
// user somehow has no memberships yet.
export async function defaultActiveOrganization(
	db: DrizzleDb,
	session: { userId: string; activeOrganizationId?: string | null }
): Promise<{ data: { activeOrganizationId: string } } | undefined> {
	if (session.activeOrganizationId) return undefined;

	const [firstMembership] = await db
		.select()
		.from(member)
		.where(eq(member.userId, session.userId))
		.orderBy(asc(member.createdAt))
		.limit(1);
	if (!firstMembership) return undefined;

	return { data: { activeOrganizationId: firstMembership.organizationId } };
}

export function getAuth(platform?: App.Platform) {
	const authEnv = getEnv();

	// getDb() is called exactly ONCE here, not once per call site — the same
	// `db` instance is threaded through both the drizzleAdapter and the
	// databaseHooks below instead of each opening its own connection.
	const db = getDb(platform);

	// `authInstance` is referenced by the `user.create.after` hook below
	// before it's assigned — that's fine: the hook function itself only runs
	// later (on an actual signup), by which point `authInstance` has been
	// assigned via closure. Mirrors the Next.js sibling template's getAuth().
	const authInstance = betterAuth({
		baseURL: authEnv.ORIGIN,
		secret: authEnv.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'pg', schema }),

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

		// Default owner/admin/member roles + built-in permission statements — no
		// custom `ac`/`roles`, no `teams`, no `dynamicAccessControl`. Every
		// signup gets a personal org (databaseHooks below);
		// allowUserToCreateOrganization additionally lets users create further
		// orgs beyond that one.
		plugins: [
			organization({ allowUserToCreateOrganization: true }),
			sveltekitCookies(getRequestEvent) // must stay last in the array
		],

		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						await createPersonalOrgForUser(authInstance, user);
					}
				}
			},
			session: {
				create: {
					before: async (session) => {
						// `session.activeOrganizationId` isn't part of better-auth's
						// base Session type (it's added at runtime by the
						// organization plugin), so the databaseHooks callback type
						// only knows about it via the callback's
						// `& Record<string, unknown>` component, which types the
						// value as `unknown`. Cast it to what it actually is at
						// runtime.
						return defaultActiveOrganization(db, {
							userId: session.userId,
							activeOrganizationId: session.activeOrganizationId as string | null | undefined
						});
					}
				}
			}
		}
	});

	return authInstance;
}
