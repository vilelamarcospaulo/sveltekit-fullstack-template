// Hyperdrive-first, DATABASE_URL-fallback: a deployed Worker gets its
// connection string from the "HYPERDRIVE" binding (wrangler.jsonc);
// everything else (`vite dev` without a resolved binding, Vitest,
// drizzle-kit) falls back to a direct DATABASE_URL read.
//
// Builds a fresh client on every call — deliberately not cached at module
// scope or on globalThis. A Workers TCP socket (which the "postgres" driver
// holds open) is only valid for the request that opened it; caching a client
// across requests in the same isolate risks later, unrelated requests
// reusing a torn-down socket. Hyperdrive already keeps the expensive
// database-side connections warm, so paying for a new local client per call
// is cheap — same reasoning as the Next.js sibling template's src/lib/db.ts,
// just threading the Cloudflare bindings through SvelteKit's `platform`
// parameter instead of a global-context helper (SvelteKit has no
// request-context-free equivalent to Next's getCloudflareContext(); bindings
// only exist on the request `event`).
//
// Request-scoped accessor — call from within a `load` function, form action,
// `+server.ts` handler, or hooks.server.ts; never store its result at module
// top level.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

function resolveConnectionString(platform?: App.Platform): string {
	const hyperdriveUrl = platform?.env?.HYPERDRIVE?.connectionString;
	if (hyperdriveUrl) return hyperdriveUrl;

	const databaseUrl = env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error(
			'No database connection available: neither the HYPERDRIVE binding nor DATABASE_URL is set.'
		);
	}
	return databaseUrl;
}

export function getDb(platform?: App.Platform): DrizzleDb {
	const client = postgres(resolveConnectionString(platform));
	return drizzle(client, { schema });
}
