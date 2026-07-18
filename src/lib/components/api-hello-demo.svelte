<script lang="ts">
	// SvelteKit counterpart to the Next.js sibling template's
	// src/app/api-hello-demo.tsx — calls this app's own /api/hello route
	// (src/routes/api/hello/+server.ts) from the client and shows the raw
	// JSON response. No auth involved, unlike profile-api-demo.svelte.
	import { apiFetch } from '$lib/api-client';
	import { Button } from '$lib/components/ui/button';

	let result = $state<string | null>(null);
	let error = $state<string | null>(null);
	let pending = $state(false);

	async function callApi() {
		pending = true;
		error = null;
		try {
			// apiFetch throws on both network rejection and non-ok responses; this
			// demo collapses both to the same "failed to reach" message, matching
			// the Next.js template's api-hello-demo.tsx.
			const data = await apiFetch<unknown>('/api/hello');
			result = JSON.stringify(data, null, 2);
		} catch {
			result = null;
			error = 'Failed to reach /api/hello.';
		} finally {
			pending = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<Button variant="outline" size="sm" onclick={callApi} disabled={pending}>
		{pending ? 'Fetching…' : 'Call /api/hello'}
	</Button>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	{#if result}
		<pre
			class="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">{result}</pre>
	{/if}
</div>
