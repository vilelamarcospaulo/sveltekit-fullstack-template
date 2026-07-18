// Validated environment module.
//
// getEnv() validates required vars and throws a single descriptive error if
// any are absent. It's a function, not a module-load-time constant, because
// under Cloudflare Workers vars are only reliably populated per-request —
// calling getEnv() from request-scoped code (a `load` function, a form
// action, a `+server.ts` handler, or `hooks.server.ts`) is safe in every
// environment this app runs in (`vite dev`, Vitest, and a deployed Worker).
//
// $env/dynamic/private (not $env/static/private) deliberately: static env is
// inlined at build time, which breaks for anything set only at runtime via
// `wrangler secret put` in a deployed Worker.
//
// DATABASE_URL is deliberately NOT in REQUIRED_VARS: in a deployed Worker
// it's not set at all (Hyperdrive supersedes it — see
// src/lib/server/db/index.ts's getDb()), and this module has no way to know
// which environment it's running in. getDb() reads DATABASE_URL directly,
// narrowly, only on its non-Worker fallback path.
//
// Usage:
//   import { getEnv } from "$lib/server/env";
//   getEnv().ORIGIN  // typed string, guaranteed non-empty
//   (call once per function and reuse the result, rather than calling
//   getEnv() repeatedly, to avoid redundant validation passes)
import { env } from '$env/dynamic/private';

const REQUIRED_VARS = [
	'BETTER_AUTH_SECRET',
	'ORIGIN',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET'
] as const;

type EnvVarName = (typeof REQUIRED_VARS)[number];

export function getEnv(): Record<EnvVarName, string> {
	const missing: EnvVarName[] = [];

	for (const key of REQUIRED_VARS) {
		const value = env[key];
		if (!value || value.trim() === '') {
			missing.push(key);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			[
				'Missing required environment variables:',
				...missing.map((k) => `  - ${k}`),
				'',
				'Copy .env.example to .env and fill in all values.'
			].join('\n')
		);
	}

	// Non-null assertion is safe: we verified all are present in the loop above.
	return Object.fromEntries(REQUIRED_VARS.map((k) => [k, env[k]!])) as Record<EnvVarName, string>;
}
