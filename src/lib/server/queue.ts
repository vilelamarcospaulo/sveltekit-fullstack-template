// Sends via Cloudflare's HTTP API (queues.messages.push), not a native
// producer binding — this app's wrangler.jsonc doesn't declare one; the
// consumer Worker (src/worker/) never imports this file, so it's safe to use
// "$env/dynamic/private" here. Uses its own env reads instead of getEnv()
// (env.ts), which hard-requires Google OAuth vars this producer doesn't need.
import { env } from '$env/dynamic/private';
import type { JobEnvelope } from '../internal/domain/jobs.ts';
import Cloudflare from 'cloudflare';

// Local-dev escape hatch (QUEUE_LOCAL_PUSH_URL, see .env.example): `vite dev`
// and the consumer Worker's `wrangler dev` are separate processes with no
// shared queue state, so this POSTs directly to src/worker/index.ts's
// fetch() handler instead of the real Cloudflare API — no Cloudflare account
// needed locally. Leave unset for a real deploy.
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

// `queueName` is accepted but unused — CLOUDFLARE_HELLO_QUEUE_ID always
// addresses the "hello" queue; a real multi-queue setup would need a
// name -> queue-id lookup, not built since there's only one job type.
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
				'(see .env.example, paired with `pnpm run worker:dev`), or set ' +
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
