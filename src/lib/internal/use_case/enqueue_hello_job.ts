// Producer-only — never imported by src/worker/index.ts (that only pulls
// processHelloJob from jobs.ts via a relative path), so unlike jobs.ts this
// file is free to use the "$lib/*" alias and to statically import
// $lib/server/queue.ts (which itself imports the SvelteKit-only virtual
// module "$env/dynamic/private" — see queue.ts's module header).
import { HELLO_QUEUE, parseHelloJobPayload } from '$lib/internal/ports/jobs';
import { sendJob } from '$lib/server/queue';
import { newTraceId } from '$lib/server/trace';

export type EnqueueHelloJobResult =
	{ ok: true; traceId: string } | { ok: false; errors: Partial<Record<'message', string>> };

// Returns the traceId on success — the native queue binding's send() hands
// back no message id, so traceId is the only correlation id callers get.
//
// `opts.platform`: the request's event.platform, forwarded to sendJob so it
// can resolve the right transport (queue binding vs. local push URL) for the
// "hello" queue — same platform-threading convention as getDb(platform)/
// getAuth(platform) elsewhere in this app.
// `opts.traceId`: pass an existing id to continue a chain; omit to start a
// new one (auto-generated).
export async function enqueueHelloJob(
	input: unknown,
	opts: { traceId?: string; platform?: App.Platform }
): Promise<EnqueueHelloJobResult> {
	const parsed = parseHelloJobPayload(input);
	if (!parsed.ok) {
		return { ok: false, errors: parsed.errors };
	}

	const traceId = opts.traceId ?? newTraceId();
	await sendJob(HELLO_QUEUE, parsed.value, traceId, opts.platform);

	return { ok: true, traceId };
}
