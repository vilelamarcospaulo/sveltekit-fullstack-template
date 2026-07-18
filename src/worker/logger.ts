// Cloudflare Workers-runtime logger for the queue consumer. Deliberately
// separate from src/lib/server/logger.ts (the app's own logger) even though
// both end up doing the same "one JSON line via console.log/console.error"
// thing: this file must stay resolvable by wrangler's standalone esbuild
// bundle of src/worker/, so — like everything else under src/worker/ and
// src/lib/internal/{domain,use_case}/jobs.ts — it avoids any SvelteKit-only
// import (src/lib/server/logger.ts pulls in "$env/dynamic/private", a
// virtual module plain esbuild can't resolve at all).
//
// createJobLogger(bindings) lets a caller bind fields that should appear on
// every subsequent log line (traceId, jobId, queue) once per job/message,
// then call .info()/.error() per event without repeating those fields.

export type JobLog = {
	info: (fields: Record<string, unknown>, msg: string) => void;
	error: (fields: Record<string, unknown>, msg: string) => void;
};

function write(
	level: 'info' | 'error',
	bindings: Record<string, unknown>,
	fields: Record<string, unknown>,
	msg: string
): void {
	const record = {
		level,
		time: new Date().toISOString(),
		...bindings,
		...fields,
		msg
	};

	const line = JSON.stringify(record);
	if (level === 'error') {
		console.error(line);
	} else {
		console.log(line);
	}
}

// Creates a logger bound to `bindings` (e.g. { traceId, jobId, queue }) so
// every log line emitted through the returned object carries them without
// the caller having to repeat them at each call site.
export function createJobLogger(bindings: Record<string, unknown>): JobLog {
	return {
		info: (fields, msg) => write('info', bindings, fields, msg),
		error: (fields, msg) => write('error', bindings, fields, msg)
	};
}
