// Native producer binding (wrangler.jsonc's HELLO_QUEUE) is the real
// transport — only resolves in a deployed Worker or real `wrangler dev`.
// Plain `vite dev` never populates platform.env (same as HYPERDRIVE, see
// src/lib/server/db/index.ts), so it falls back to QUEUE_LOCAL_PUSH_URL: a
// plain fetch against the consumer Worker's own local-only push simulation
// (src/worker/index.ts), since `vite dev` and the consumer's `wrangler dev`
// are separate processes with no shared queue state. Uses its own env read
// instead of getEnv() (env.ts), which hard-requires Google OAuth vars this
// producer doesn't need.
import { env } from '$env/dynamic/private';
import type { JobEnvelope } from '../internal/domain/jobs.ts';
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

// `queueName` is accepted but unused — the injected `queueBinding` (or, for
// local dev, QUEUE_LOCAL_PUSH_URL) always addresses the "hello" queue; a
// real multi-queue setup would need a name -> binding lookup, not built
// since there's only one job type.
export async function sendJob<T extends object>(
	queueName: string,
	payload: T,
	traceId: string,
	queueBinding?: Queue<JobEnvelope<T>>
): Promise<void> {
	void queueName;

	if (queueBinding) {
		const envelope: JobEnvelope<T> = { payload, traceId };
		await queueBinding.send(envelope);
		return;
	}

	const localPushUrl = env.QUEUE_LOCAL_PUSH_URL;
	if (localPushUrl) {
		await sendJobToLocalPushUrl(localPushUrl, payload, traceId);
		return;
	}

	throw new Error(
		'No queue transport configured. In a deployed Worker (or real `wrangler dev`), ' +
			"pass platform.env.HELLO_QUEUE as sendJob's 4th argument — wrangler.jsonc " +
			'already declares that producer binding. For plain `vite dev`, set ' +
			'QUEUE_LOCAL_PUSH_URL instead (see .env.example, paired with `pnpm run worker:dev`).'
	);
}
