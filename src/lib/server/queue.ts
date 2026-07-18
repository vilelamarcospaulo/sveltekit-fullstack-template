// QUEUE_LOCAL_PUSH_URL is checked BEFORE the native platform binding, not
// after: @sveltejs/adapter-cloudflare's dev emulation (getPlatformProxy)
// resolves platform.env.HELLO_QUEUE via a same-process, no-consumer Miniflare
// simulation even under plain `vite dev` — wrangler.jsonc declares no
// consumer for "hello", only wrangler.queue.jsonc's separate Worker does
// (run via `pnpm run worker:dev`, a different process). If the binding were
// checked first, a locally-resolved-but-consumerless binding would silently
// swallow the job instead of reaching that sibling process. So whenever a
// developer has QUEUE_LOCAL_PUSH_URL configured — i.e. they're deliberately
// running the local producer/consumer bridge — it always wins; the native
// binding is only used when no such bridge is configured (a deployed Worker,
// or `wrangler deploy --dry-run`). Uses its own env read instead of getEnv()
// (env.ts), which hard-requires Google OAuth vars this producer doesn't need.
import { env } from '$env/dynamic/private';
import { HELLO_QUEUE, type JobEnvelope } from '$lib/internal/domain/jobs';
import type { Queue } from '@cloudflare/workers-types';

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
		parsedBody = undefined;
	}

	if (!response.ok || parsedBody?.success !== true) {
		throw new Error(
			`Failed to send job to local queue push endpoint (HTTP ${response.status} ${response.statusText}): ${responseText || 'no response body'}`
		);
	}
}

// The one place that knows which platform.env binding backs which queue
// name — callers pass a queue name, never a binding, so this is the only
// spot that needs updating when a second queue is added.
function resolveQueueBinding<T extends object>(
	queueName: string,
	platform?: App.Platform
): Queue<JobEnvelope<T>> | undefined {
	switch (queueName) {
		case HELLO_QUEUE:
			return platform?.env.HELLO_QUEUE as Queue<JobEnvelope<T>> | undefined;
		default:
			return undefined;
	}
}

export async function sendJob<T extends object>(
	queueName: string,
	payload: T,
	traceId: string,
	platform?: App.Platform
): Promise<void> {
	const localPushUrl = env.QUEUE_LOCAL_PUSH_URL;
	if (localPushUrl) {
		await sendJobToLocalPushUrl(localPushUrl, payload, traceId);
		return;
	}

	const queueBinding = resolveQueueBinding<T>(queueName, platform);
	if (queueBinding) {
		const envelope: JobEnvelope<T> = { payload, traceId };
		await queueBinding.send(envelope);
		return;
	}

	throw new Error(
		`No queue transport configured for queue "${queueName}". In a deployed Worker (or real ` +
			"`wrangler dev`), pass the request's platform as sendJob's 4th argument — " +
			'wrangler.jsonc already declares the producer binding this resolves to. For plain ' +
			'`vite dev`, set QUEUE_LOCAL_PUSH_URL instead (see .env.example, paired with ' +
			'`pnpm run worker:dev`).'
	);
}
