// A single traceId per causal chain: generated once at the root (a form
// action) and carried unchanged through every job it spawns, however many
// hops deep (request -> job A -> job B -> ...). Lets every log line in that
// chain be grepped together regardless of which process (the SvelteKit app
// or the consumer Worker) emitted it.
//
// No repo imports (just the global WebCrypto `crypto`), so this file is
// trivially safe to import via a relative path from src/worker/ too — see
// src/lib/internal/use_case/jobs.ts for the full explanation of that
// constraint. It lives under src/lib/server/ (not src/lib/internal/) because
// nothing about it is framework-free-by-necessity — it's just conveniently
// dependency-free — but src/worker/ still imports it via a relative path
// rather than "$lib/server/trace" so the same source file works unmodified
// under wrangler's standalone esbuild bundling.
export function newTraceId(): string {
	return crypto.randomUUID();
}
