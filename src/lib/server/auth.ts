// Builds a fresh better-auth instance per call — never cached, since
// betterAuth() captures a Drizzle client (and its "postgres" socket) at
// construction time; caching would reuse that socket across requests in the
// same isolate (same issue db/index.ts avoids). Call only from request-scoped
// code.
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

// Structural type (not ReturnType<typeof getAuth>) — getAuth() calls this
// from inside its own databaseHooks, so that would be circular.
type OrganizationCapableAuth = {
	api: {
		createOrganization: (input: {
			body: { name: string; slug: string; userId: string };
		}) => Promise<unknown>;
	};
};

// Auto-creates a personal workspace org per signup. Deterministic slug
// (user.id) avoids collision handling.
//
// No `headers` key is passed to createOrganization — better-auth's
// create-org route only skips its session check when both ctx.headers and
// ctx.request are falsy (crud-org.mjs's `!session && (ctx.request ||
// ctx.headers)` guard); there's no session yet at signup, so any headers
// here throw UNAUTHORIZED. Don't add one.
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

// Defaults a new session's activeOrganizationId to the user's earliest
// membership — createPersonalOrgForUser has no session to call
// setActiveOrganization on, so this backfills it. No-op if already set or no
// memberships exist.
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

	// getDb() called once here and shared by drizzleAdapter + databaseHooks
	// below, not reopened per call site.
	const db = getDb(platform);

	// `authInstance` is referenced before assignment below — fine, since the
	// hook only runs later (on signup), by which point the closure has resolved.
	const authInstance = betterAuth({
		baseURL: authEnv.ORIGIN,
		secret: authEnv.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'pg', schema }),

		trustedOrigins: [new URL(authEnv.ORIGIN).origin],

		socialProviders: {
			google: {
				clientId: authEnv.GOOGLE_CLIENT_ID,
				clientSecret: authEnv.GOOGLE_CLIENT_SECRET
			}
		},

		// Disabled: better-auth's "memory" rate-limit storage is per-process,
		// which doesn't work across Workers' many concurrent isolates — would
		// silently no-op in production. Revisit with a durable store (KV/D1).
		rateLimit: {
			enabled: false
		},

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
						// activeOrganizationId isn't in better-auth's base Session type
						// (added at runtime by the org plugin) — the callback types it
						// as `unknown`; cast to its actual runtime type.
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
