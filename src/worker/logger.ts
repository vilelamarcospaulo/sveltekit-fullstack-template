// Separate from src/lib/server/logger.ts despite doing the same thing —
// that file imports "$env/dynamic/private", a virtual module plain esbuild
// (wrangler's bundler for src/worker/) can't resolve.

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

// Binds fields (e.g. traceId/jobId/queue) once so callers don't repeat them.
export function createJobLogger(bindings: Record<string, unknown>): JobLog {
	return {
		info: (fields, msg) => write('info', bindings, fields, msg),
		error: (fields, msg) => write('error', bindings, fields, msg)
	};
}
