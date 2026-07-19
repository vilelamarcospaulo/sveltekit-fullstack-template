// Consumer-side only. Relative imports with explicit ".ts" extensions so
// this file loads unmodified under both Vite/SvelteKit and the Worker
// consumer (wrangler's esbuild bundle doesn't resolve "$lib/*"). The
// producer side (enqueueJob) lives in $lib/server/queue.ts instead — never
// reachable from src/worker/index.ts, so it's free to import $env/dynamic/private
// (see that file's module header).
import type { HelloJobPayload } from '../ports/jobs.ts';

// Structural subset both the app logger and worker/logger.ts's
// createJobLogger satisfy — this file depends on neither implementation.
type JobLog = {
	info: (fields: Record<string, unknown>, msg: string) => void;
};

// `ctx.log` is already bound to this job's traceId/jobId — use it, not a
// bare logger, to stay correlated. Extension point for future job types:
// validate payload, do work, log start/completion.
//
// For a follow-up job, pass `ctx.traceId` through as enqueueJob's
// ($lib/server/queue.ts) `opts.traceId` to keep it in the same chain.
export async function processHelloJob(
	payload: HelloJobPayload,
	ctx: { traceId: string; jobId: string; log: JobLog }
): Promise<void> {
	ctx.log.info({ message: payload.message }, 'hello_job_processing');

	// Simulated work standing in for a real async op — short so tests stay fast.
	await new Promise((resolve) => setTimeout(resolve, 300));

	ctx.log.info({ message: payload.message }, 'hello_job_completed');
}
