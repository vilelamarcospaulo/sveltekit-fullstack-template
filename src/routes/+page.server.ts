import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { enqueueHelloJob } from '$lib/internal/use_case/enqueue_hello_job';
import { newTraceId } from '$lib/server/trace';

// Form-layer bound, tighter than the port schema's 500-char max
// (ports/jobs.ts).
const MAX_JOB_MESSAGE_LENGTH = 200;

// Named action matching job-demo.svelte's `action="/?/submitHelloJob"`.
export const actions: Actions = {
	submitHelloJob: async (event) => {
		if (!event.locals.user) {
			return fail(401, { error: 'unauthenticated' });
		}

		const formData = await event.request.formData();
		const message = formData.get('message');

		if (typeof message !== 'string' || message.trim().length === 0) {
			return fail(400, { errors: { message: 'Message must not be empty.' } });
		}
		if (message.length > MAX_JOB_MESSAGE_LENGTH) {
			return fail(400, {
				errors: { message: `Message must be ${MAX_JOB_MESSAGE_LENGTH} characters or fewer.` }
			});
		}

		// Root of a new job chain — a fresh traceId is minted here and carried
		// forward by every job it spawns.
		const traceId = newTraceId();
		const result = await enqueueHelloJob({ message }, { traceId, platform: event.platform });

		if (!result.ok) {
			return fail(400, { errors: result.errors });
		}

		return { traceId: result.traceId };
	}
};
