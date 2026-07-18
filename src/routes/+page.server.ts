import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { enqueueHelloJob } from '$lib/internal/use_case/jobs';
import { sendJob } from '$lib/server/queue';
import { newTraceId } from '$lib/server/trace';

// Mirrors the Next.js sibling template's MAX_JOB_MESSAGE_LENGTH (src/app/
// actions.ts) — a form-layer bound tighter than the domain schema's 500-char
// max (src/lib/internal/domain/jobs.ts), same relationship the Next
// template's action/schema pair has.
const MAX_JOB_MESSAGE_LENGTH = 200;

// Named-action form (see src/lib/components/job-demo.svelte's
// `action="/?/submitHelloJob"`), the SvelteKit-idiomatic equivalent of the
// Next.js template's `submitHelloJob` server action (src/app/actions.ts).
export const actions: Actions = {
	submitHelloJob: async (event) => {
		// ── 1. Auth check ────────────────────────────────────────────────────
		// Matches this project's existing auth-gate convention: event.locals.user
		// is populated once per request by hooks.server.ts.
		if (!event.locals.user) {
			return fail(401, { error: 'unauthenticated' });
		}

		// ── 2. Input validation (form-layer bound) ──────────────────────────────
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

		// ── 3. Enqueue via the use case ──────────────────────────────────────
		// This request is the root of a new job chain, so a fresh traceId is
		// minted here and handed to the use case — every job this one spawns
		// will carry it forward (see src/lib/internal/use_case/jobs.ts).
		const traceId = newTraceId();
		const result = await enqueueHelloJob({ message }, { traceId, sendJob });

		// ── 4. Map validation failures (domain-layer bound, 500 chars) ──────────
		if (!result.ok) {
			return fail(400, { errors: result.errors });
		}

		return { traceId: result.traceId };
	}
};
