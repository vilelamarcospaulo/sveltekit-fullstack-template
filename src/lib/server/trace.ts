// One traceId per causal chain, generated at the root and carried through
// every job it spawns — lets every log line across processes be grepped
// together.
//
// No repo imports (just global `crypto`), so src/worker/ can import this via
// a relative path — see jobs.ts for why.
export function newTraceId(): string {
	return crypto.randomUUID();
}
