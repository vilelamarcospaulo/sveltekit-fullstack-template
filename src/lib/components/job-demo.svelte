<script lang="ts">
	// Self-contained "async job" demo card, the SvelteKit-idiomatic
	// counterpart to the Next.js sibling template's src/app/job-demo.tsx: a
	// real `<form>` posting to a named form action (src/routes/+page.server.ts's
	// `actions.submitHelloJob`) via `use:enhance`, rather than a client-invoked
	// async server-action function — SvelteKit's own recommended pattern for
	// this, and progressively enhanced (still a plain HTML form post if JS is
	// disabled).
	//
	// Not wired into src/routes/+page.svelte here — see this feature's report
	// for the exact snippet to drop in there (left to the orchestrator since
	// other features are also touching that file concurrently).
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';

	type SubmitResult = { ok: true; traceId: string } | { ok: false; error: string };

	let message = $state('');
	let pending = $state(false);
	let result = $state<SubmitResult | null>(null);

	const handleSubmit: SubmitFunction = () => {
		pending = true;
		result = null;

		return async ({ result: actionResult }) => {
			pending = false;

			if (actionResult.type === 'success') {
				const data = actionResult.data as { traceId?: string } | undefined;
				result = data?.traceId
					? { ok: true, traceId: data.traceId }
					: { ok: false, error: 'Something went wrong. Please try again.' };
				message = '';
				return;
			}

			if (actionResult.type === 'failure') {
				const data = actionResult.data as
					{ error?: string; errors?: { message?: string } } | undefined;
				if (data?.error === 'unauthenticated') {
					result = { ok: false, error: 'unauthenticated' };
				} else {
					result = {
						ok: false,
						error: data?.errors?.message ?? 'Something went wrong. Please try again.'
					};
				}
				return;
			}

			// "error" (an unhandled exception in the action) — no structured data
			// to show, just the generic fallback.
			result = { ok: false, error: 'Something went wrong. Please try again.' };
		};
	};
</script>

<form
	method="post"
	action="/?/submitHelloJob"
	class="flex flex-col gap-4"
	use:enhance={handleSubmit}
>
	<input
		type="text"
		name="message"
		bind:value={message}
		placeholder="Enter a message"
		class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
	/>

	<Button type="submit" disabled={pending}>
		{pending ? 'Enqueuing…' : 'Enqueue job'}
	</Button>

	{#if result !== null}
		{#if result.ok}
			<pre
				class="overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm text-muted-foreground">Job enqueued — trace: {result.traceId}</pre>
		{:else if result.error === 'unauthenticated'}
			<!-- Friendly degraded state for logged-out visitors, matching the
			     Next.js template's job-demo.tsx. -->
			<p class="text-sm text-muted-foreground">Please sign in to try this feature.</p>
		{:else}
			<p class="text-sm text-destructive">{result.error}</p>
		{/if}
	{/if}
</form>
