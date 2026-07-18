// No framework imports — relative imports with explicit ".ts" extensions so
// this file loads unmodified under both Vite/SvelteKit and the Worker
// consumer (wrangler's esbuild bundle doesn't resolve "$lib/*").
//
// enqueueHelloJob takes its producer (sendJob) as an injected parameter
// instead of importing queue.ts directly: queue.ts uses SvelteKit's virtual
// "$env/dynamic/private" module, which plain esbuild can't resolve at all —
// a static import anywhere in this file's graph would hard-fail the
// Worker's build regardless of tree-shaking. The form action wires the real
// sendJob in (src/routes/+page.server.ts).
import {
	HELLO_QUEUE,
	parseHelloJobPayload,
	type HelloJobPayload,
	type JobEnvelope
} from '../domain/jobs.ts';
import { newTraceId } from '../../server/trace.ts';
import type { Queue } from '@cloudflare/workers-types';

// Structural type matching queue.ts's sendJob — not imported from queue.ts
// itself (see module header above).
export type SendJob = <T extends object>(
	queueName: string,
	payload: T,
	traceId: string,
	queueBinding?: Queue<JobEnvelope<T>>
) => Promise<void>;

export type EnqueueHelloJobResult =
	{ ok: true; traceId: string } | { ok: false; errors: Partial<Record<'message', string>> };

// Returns the traceId on success — the native queue binding's send() hands
// back no message id, so traceId is the only correlation id callers get.
//
// `opts.sendJob`: injected producer (always queue.ts's sendJob in practice —
// see module header for why it's not imported directly).
// `opts.queueBinding`: the deployed Worker's platform.env.HELLO_QUEUE, when
// available (see queue.ts's module header — vite dev has none).
// `opts.traceId`: pass an existing id to continue a chain; omit to start a
// new one (auto-generated).
export async function enqueueHelloJob(
	input: unknown,
	opts: { traceId?: string; sendJob: SendJob; queueBinding?: Queue<JobEnvelope<HelloJobPayload>> }
): Promise<EnqueueHelloJobResult> {
	const parsed = parseHelloJobPayload(input);
	if (!parsed.ok) {
		return { ok: false, errors: parsed.errors };
	}

	const traceId = opts.traceId ?? newTraceId();
	await opts.sendJob(HELLO_QUEUE, parsed.value, traceId, opts.queueBinding);

	return { ok: true, traceId };
}

// Structural subset both the app logger and worker/logger.ts's
// createJobLogger satisfy — this file depends on neither implementation.
type JobLog = {
	info: (fields: Record<string, unknown>, msg: string) => void;
};

// `ctx.log` is already bound to this job's traceId/jobId — use it, not a
// bare logger, to stay correlated. Extension point for future job types:
// validate payload, do work, log start/completion.
//
// For a follow-up job, pass `ctx.traceId` through as enqueueHelloJob's
// `opts.traceId` to keep it in the same chain.
export async function processHelloJob(
	payload: HelloJobPayload,
	ctx: { traceId: string; jobId: string; log: JobLog }
): Promise<void> {
	ctx.log.info({ message: payload.message }, 'hello_job_processing');

	// Simulated work standing in for a real async op — short so tests stay fast.
	await new Promise((resolve) => setTimeout(resolve, 300));

	ctx.log.info({ message: payload.message }, 'hello_job_completed');
}
