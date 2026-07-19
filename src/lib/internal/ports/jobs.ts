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

// Declarative producer-side contract for one queue: which transport name it
// maps to, and what shape a payload must have to be sent there. Pure data —
// $lib/server/queue.ts's enqueueJob() is the one generic function that
// consumes a JobPort to validate + envelope + dispatch, so adding a new
// queue producer means adding one of these, not a new use_case file.
export type JobPort<T extends object> = {
	queue: string;
	schema: z.ZodType<T>;
};

export const HELLO_JOB_PORT: JobPort<HelloJobPayload> = {
	queue: HELLO_QUEUE,
	schema: helloJobPayloadSchema
};
