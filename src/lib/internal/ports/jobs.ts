// Port, not domain: this is the message contract for the queue boundary
// (envelope shape, queue names, payload schema) — not a business entity.
// It only needs to be pure/framework-free because both sides of that
// boundary (the use_case layer and the standalone consumer Worker) import
// it, one via "$lib/*" and one via a relative path with no "$lib/*".
import { z } from 'zod';

// The demo "hello" queue proves the producer/consumer wiring end to end;
// real job queues follow the same naming convention (`<name>` + `<name>-dlq`).
export const HELLO_QUEUE = 'hello';
export const HELLO_DLQ = 'hello-dlq';

export const helloJobPayloadSchema = z.object({
	message: z.string().trim().min(1).max(500)
});

export type HelloJobPayload = z.infer<typeof helloJobPayloadSchema>;

// Wraps every job so traceId travels automatically, without each payload
// schema threading it through itself. Lives here, not in queue.ts, so both
// the producer ($lib/* import) and the consumer Worker (relative import)
// share one definition without the Worker importing queue.ts.
export type JobEnvelope<T> = {
	payload: T;
	traceId: string;
};

export type ParseHelloJobPayloadResult =
	{ ok: true; value: HelloJobPayload } | { ok: false; errors: Partial<Record<'message', string>> };

export function parseHelloJobPayload(input: unknown): ParseHelloJobPayloadResult {
	const result = helloJobPayloadSchema.safeParse(input);
	if (result.success) {
		return { ok: true, value: result.data };
	}

	const fieldError = result.error.issues.find((issue) => issue.path[0] === 'message');

	return {
		ok: false,
		errors: {
			message: fieldError
				? 'Message is required and must be 500 characters or fewer.'
				: 'Invalid job payload.'
		}
	};
}
