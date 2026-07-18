// Jobs use cases: orchestration between the HTTP/UI boundary (SvelteKit form
// actions) or the worker process, and the queue. No framework imports.
// Every import is relative with an explicit ".ts" extension so this file
// loads unmodified under both Vite/SvelteKit (app code importing it via
// "$lib/internal/use_case/jobs") and the Cloudflare Worker consumer under
// src/worker/ (wrangler-bundled with plain esbuild, which does not resolve
// the "$lib/*" alias).
//
// Deviation from the Next.js sibling template's equivalent file: there,
// enqueueHelloJob imports its producer client (lib/queue.ts) directly,
// because that client's only special import (@opennextjs/cloudflare) is a
// real npm package — esbuild can resolve it even though the Worker's own
// entry point never calls sendJob, and tree-shaking drops the dead code
// after resolution succeeds. This project's producer client
// (src/lib/server/queue.ts) instead reads config via SvelteKit's
// "$env/dynamic/private" — a *virtual* module synthesized by the Vite/
// SvelteKit plugin, not a real file or package. Plain esbuild (what wrangler
// uses to bundle src/worker/) cannot resolve that specifier at all: module
// resolution happens before tree-shaking, so a static top-level import of
// queue.ts anywhere in this file's transitive graph would hard-fail the
// Worker's build, dead code or not. So enqueueHelloJob takes its producer
// as an injected parameter instead of importing it — this file (and
// everything it imports) stays free of any SvelteKit- or Node-specific
// module, which is arguably *more* in the spirit of "no framework imports"
// than the ported version. The SvelteKit form action wires the real
// sendJob in (see src/routes/+page.server.ts).
import { HELLO_QUEUE, parseHelloJobPayload, type HelloJobPayload } from '../domain/jobs.ts';
import { newTraceId } from '../../server/trace.ts';

// Structural type for the producer, matching src/lib/server/queue.ts's
// sendJob signature — deliberately not imported from queue.ts itself (see
// the module-level comment above for why).
export type SendJob = <T extends object>(
	queueName: string,
	payload: T,
	traceId: string
) => Promise<void>;

export type EnqueueHelloJobResult =
	{ ok: true; traceId: string } | { ok: false; errors: Partial<Record<'message', string>> };

// Validate raw input and enqueue it onto the hello queue. Returns the
// traceId it was sent with on success — Cloudflare Queues' HTTP push API
// doesn't hand back a message id, so traceId is the only correlation id
// callers get (and the only one they need: every log line the job produces,
// in both the app and the worker, is keyed on it).
//
// `opts.sendJob`: the producer function to enqueue through — always the real
// src/lib/server/queue.ts's sendJob in practice, injected by the caller
// (never imported here directly — see the module-level comment above).
// `opts.traceId`: pass this when enqueueing from inside a job handler that's
// itself already part of a chain (e.g. `ctx.traceId` from the worker's queue
// handler), so the whole chain shares one id. Omit it when this is the root
// of a new chain (e.g. a fresh form submission) — a new traceId is generated
// automatically.
export async function enqueueHelloJob(
	input: unknown,
	opts: { traceId?: string; sendJob: SendJob }
): Promise<EnqueueHelloJobResult> {
	const parsed = parseHelloJobPayload(input);
	if (!parsed.ok) {
		return { ok: false, errors: parsed.errors };
	}

	const traceId = opts.traceId ?? newTraceId();
	await opts.sendJob(HELLO_QUEUE, parsed.value, traceId);

	return { ok: true, traceId };
}

// Minimal structural logger interface — a small subset of the shape both a
// SvelteKit-side logger and src/worker/logger.ts's createJobLogger already
// satisfy, so either can be passed in as `ctx.log` without this file
// depending on either implementation.
type JobLog = {
	info: (fields: Record<string, unknown>, msg: string) => void;
};

// The actual job body, called identically by the worker's queue handler
// (src/worker/index.ts) and by tests. `ctx.log` is a logger already bound to
// this job's traceId/jobId — use it instead of a bare logger so every line
// stays correlated. Kept intentionally trivial — this is the extension point
// future real jobs (LLM calls, emails, etc.) will follow: validate/receive a
// typed payload, do the work, log start/completion. Business logic for a new
// job type plugs in here, not in the worker's dispatch loop.
//
// If a job needs to enqueue a follow-up job (Message A -> Message B), pass
// `ctx.traceId` straight through as `enqueueHelloJob`'s `opts.traceId` so
// the follow-up stays part of the same chain (and inject the real sendJob
// the same way the SvelteKit form action does).
export async function processHelloJob(
	payload: HelloJobPayload,
	ctx: { traceId: string; jobId: string; log: JobLog }
): Promise<void> {
	ctx.log.info({ message: payload.message }, 'hello_job_processing');

	// Simulated work standing in for a real async operation (LLM call, email
	// send, etc.). Short and bounded so the demo/tests stay fast.
	await new Promise((resolve) => setTimeout(resolve, 300));

	ctx.log.info({ message: payload.message }, 'hello_job_completed');
}
