// Consumes "hello"/"hello-dlq" — a second Worker, independent from the app's
// own (wrangler.jsonc), wired via wrangler.queue.jsonc's [[queues.consumers]].
//
// Per-message ack/retry: a failure is caught and logged, not rethrown, so
// one bad message doesn't block its batch-mates.
//
// Relative imports with explicit ".ts": wrangler's esbuild bundling doesn't
// resolve "$lib/*", and can't resolve SvelteKit virtual modules like
// "$env/dynamic/private" at all (build hard-fails regardless of
// tree-shaking) — this only imports jobs.ts (processHelloJob), never the
// producer side (enqueue_hello_job.ts), which is the one that reaches
// $env/dynamic/private via $lib/server/queue.ts.
import type { ExecutionContext, MessageBatch, Queue } from '@cloudflare/workers-types';
import {
	HELLO_DLQ,
	HELLO_QUEUE,
	type HelloJobPayload,
	type JobEnvelope
} from '../lib/internal/domain/jobs.ts';
import { processHelloJob } from '../lib/internal/use_case/jobs.ts';
import { createJobLogger } from './logger.ts';

type Env = {
	// Producer binding for the same queue this Worker consumes — unused in
	// production (queue.ts pushes via the HTTP API instead); exists so fetch()
	// below can simulate that push locally.
	HELLO_QUEUE: Queue<JobEnvelope<HelloJobPayload>>;
	// Only set locally via gitignored .dev.vars — `wrangler deploy` doesn't
	// read it, so this stays undefined (and fetch() a 404) in production.
	LOCAL_DEV_PUSH_ENABLED?: string;
};

const worker = {
	// Local-dev stand-in for Cloudflare's push API — queue.ts points here via
	// QUEUE_LOCAL_PUSH_URL, running the whole loop offline. Mirrors the real
	// API's request/response shape so queue.ts needs no separate parsing.
	async fetch(request: Request, env: Env): Promise<Response> {
		if (env.LOCAL_DEV_PUSH_ENABLED !== 'true') {
			return new Response('Not Found', { status: 404 });
		}
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const { body } = (await request.json()) as {
			body: JobEnvelope<HelloJobPayload>;
		};
		await env.HELLO_QUEUE.send(body);

		return new Response(JSON.stringify({ success: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	},

	async queue(
		batch: MessageBatch<JobEnvelope<HelloJobPayload>>,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		// Unused, but kept in the signature to match Cloudflare's queue()
		// handler shape.
		void env;
		void ctx;

		if (batch.queue === HELLO_QUEUE) {
			for (const message of batch.messages) {
				const { payload, traceId } = message.body;
				const log = createJobLogger({
					traceId,
					jobId: message.id,
					queue: batch.queue
				});

				log.info({}, 'job_started');
				try {
					await processHelloJob(payload, { traceId, jobId: message.id, log });
					log.info({}, 'job_completed');
					message.ack();
				} catch (error) {
					log.error({ err: error instanceof Error ? error.message : String(error) }, 'job_failed');
					message.retry();
				}
			}
			return;
		}

		if (batch.queue === HELLO_DLQ) {
			// Visibility only — no re-drive logic; out of scope for this scaffold.
			for (const message of batch.messages) {
				const { payload, traceId } = message.body;
				const log = createJobLogger({
					traceId,
					jobId: message.id,
					queue: batch.queue
				});

				log.error({ payload }, 'job_dead_lettered');
				message.ack();
			}
			return;
		}
	}
};

export default worker;
