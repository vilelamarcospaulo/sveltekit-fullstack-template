// A function, not a module-level constant — Cloudflare Workers vars are only
// reliably populated per-request; call from request-scoped code only.
//
// $env/dynamic/private, not $env/static/private: static env is inlined at
// build time, breaking runtime-only vars set via `wrangler secret put`.
//
// DATABASE_URL isn't in REQUIRED_VARS: Hyperdrive supersedes it in a
// deployed Worker, where it's unset; getDb() reads it directly on its
// non-Worker fallback path instead.
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
