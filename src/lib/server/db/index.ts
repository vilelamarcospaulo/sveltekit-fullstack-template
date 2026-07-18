// Hyperdrive-first, DATABASE_URL-fallback: a deployed Worker reads the
// "HYPERDRIVE" binding; everything else falls back to DATABASE_URL directly.
//
// Builds a fresh client per call, never cached — a Workers TCP socket (held
// open by the "postgres" driver) is only valid for the request that opened
// it; caching risks reusing a torn-down socket across requests in the same
// isolate. Hyperdrive keeps the expensive DB-side connections warm, so a new
// local client per call is cheap.
//
// Request-scoped — call from `load`/actions/`+server.ts`/hooks.server.ts;
// never store the result at module scope.
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
