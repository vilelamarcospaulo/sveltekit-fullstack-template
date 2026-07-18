// Producer client for Cloudflare Queues.
//
// This is the "send" half only: it pushes messages onto the "hello" queue
// via Cloudflare's real HTTP API (the `cloudflare` SDK's queues.messages.push,
// authenticated with an account-scoped API token) rather than a native queue
// producer *binding*. That's a deliberate difference from the Next.js
// sibling template's src/lib/queue.ts, which uses a binding declared in its
// own app-facing wrangler config: this project's equivalent app config
// (wrangler.jsonc) is explicitly off-limits to this feature (see
// wrangler.queue.jsonc's own header comment) — adding a producer binding
// there isn't an option, so this file talks to Cloudflare's control-plane
// API directly instead. The consumer half lives separately as a Cloudflare
// Worker (src/worker/, deployed independently via `wrangler deploy --config
// wrangler.queue.jsonc`), which does NOT import this file — it receives
// messages through its own native queue consumer binding, unrelated to this
// one.
//
// This file is imported only by SvelteKit app code (via the "$lib/server/queue"
// alias, which Vite resolves) — never by src/worker/, which only reaches
// processHelloJob from src/lib/internal/use_case/jobs.ts, not sendJob (see
// that file's module-level comment for why sendJob is injected rather than
// imported there). That's what makes it safe for this file, uniquely among
// the queue-related files, to import SvelteKit's "$env/dynamic/private"
// below — a virtual module plain esbuild (which wrangler uses to bundle
// src/worker/) cannot resolve at all. $env/dynamic/private (not
// $env/static/private) for the same reason src/lib/server/env.ts uses it:
// static env is inlined at build time, which breaks for anything set only at
// runtime via `wrangler secret put` in a deployed Worker. Deliberately NOT
// this project's getEnv() (src/lib/server/env.ts): that wrapper hard-requires
// Google OAuth vars a standalone producer context shouldn't need.
import { env } from '$env/dynamic/private';
import type { JobEnvelope } from '../internal/domain/jobs.ts';
import Cloudflare from 'cloudflare';

// Local-dev escape hatch: when set (e.g. in .env, pointed at `wrangler
// dev`'s default http://localhost:8787), sendJob POSTs here with a plain
// `fetch` instead of using the Cloudflare API below. This exists because
// `vite dev` and the consumer Worker's `wrangler dev` (see
// queue-worker:dev in package.json) run as two separate processes with no
// shared queue state — there's no way for this file, running inside `vite
// dev`, to deliver a message to the consumer running in a different
// process, and there's no Cloudflare account needed for local dev either.
// Routing through this HTTP bridge instead lets the whole producer/consumer
// loop run offline. The receiving end is src/worker/index.ts's fetch()
// handler, which mirrors the real push API's request/response shape
// (`{ body: <envelope> }` in, `{success: true}` out) and forwards onto its
// own local [[queues.producers]] binding that Miniflare simulates within
// that same process. Leave unset for a real deploy — see .env.example.
//
// `payload`/`traceId` are the same two arguments the real path wraps into a
// JobEnvelope (see below) — this function does that wrapping itself since
// it bypasses the Cloudflare API entirely.
async function sendJobToLocalPushUrl<T extends object>(
	localPushUrl: string,
	payload: T,
	traceId: string
): Promise<void> {
	const envelope: JobEnvelope<T> = { payload, traceId };

	const response = await fetch(localPushUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ body: envelope })
	});

	const responseText = await response.text();
	let parsedBody: { success?: boolean } | undefined;
	try {
		parsedBody = responseText ? (JSON.parse(responseText) as { success?: boolean }) : undefined;
	} catch {
		// Non-JSON response body — fall through and report the raw text.
		parsedBody = undefined;
	}

	if (!response.ok || parsedBody?.success !== true) {
		throw new Error(
			`Failed to send job to local queue push endpoint (HTTP ${response.status} ${response.statusText}): ${responseText || 'no response body'}`
		);
	}
}

// The one way any use_case enqueues a job (via injection — see this file's
// header comment and src/lib/internal/use_case/jobs.ts's enqueueHelloJob).
// Wraps `payload` in the same envelope shape the worker expects (see
// JobEnvelope in src/lib/internal/domain/jobs.ts) and pushes it onto the
// "hello" queue via Cloudflare's real HTTP API, or its local-dev stand-in —
// see sendJobToLocalPushUrl above.
//
// `queueName` is accepted (and still passed by callers like
// enqueueHelloJob) for API shape / future-proofing, but is NOT used to
// address the queue — CLOUDFLARE_HELLO_QUEUE_ID above always addresses the
// "hello" queue. This is a known scope limitation of this single-queue demo:
// a real multi-queue setup would need a name -> queue-id lookup, which isn't
// built here since there's only one job type today.
export async function sendJob<T extends object>(
	queueName: string,
	payload: T,
	traceId: string
): Promise<void> {
	void queueName;

	const localPushUrl = env.QUEUE_LOCAL_PUSH_URL;
	if (localPushUrl) {
		await sendJobToLocalPushUrl(localPushUrl, payload, traceId);
		return;
	}

	const envelope: JobEnvelope<T> = { payload, traceId };

	const accountId = env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = env.CLOUDFLARE_API_TOKEN;
	const queueId = env.CLOUDFLARE_HELLO_QUEUE_ID;

	if (!accountId || !apiToken || !queueId) {
		throw new Error(
			'No queue transport configured. Set QUEUE_LOCAL_PUSH_URL for local dev ' +
				'(see .env.example, paired with `pnpm run queue-worker:dev`), or set ' +
				'CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN/CLOUDFLARE_HELLO_QUEUE_ID ' +
				'for a real deploy.'
		);
	}

	const client = new Cloudflare({ apiToken });
	await client.queues.messages.push(queueId, {
		account_id: accountId,
		body: envelope,
		content_type: 'json'
	});
}
