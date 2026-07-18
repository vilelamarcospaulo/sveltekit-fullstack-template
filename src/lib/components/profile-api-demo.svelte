<script lang="ts">
	// GET-only route — writes go through the page's form action, not a PUT.
	import { apiFetch, ApiError, AuthError } from '$lib/api-client';
	import { Button } from '$lib/components/ui/button';
	import type { ProfileView } from '$lib/types/api';

	let lastResponse = $state<ProfileView | null>(null);
	let error = $state<string | null>(null);
	let pending = $state(false);

	async function handleGet() {
		pending = true;
		error = null;
		try {
			lastResponse = await apiFetch<ProfileView>('/api/profile');
		} catch (err) {
			if (err instanceof AuthError) {
				error = 'Your session expired — sign in again to use this demo.';
			} else if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Network error. Please try again.';
			}
		} finally {
			pending = false;
		}
	}
</script>

<div class="flex flex-col gap-3 rounded-lg border p-4">
	<div>
		<h2 class="text-sm font-semibold">Try the API directly</h2>
		<p class="text-xs text-muted-foreground">
			The same profile data via <code class="font-mono">GET /api/profile</code>
			— a JSON API calling into the same use case as the form above, called here with a plain client-side
			<code class="font-mono">fetch</code>.
		</p>
	</div>

	<div>
		<Button variant="outline" size="sm" onclick={handleGet} disabled={pending}>
			{pending ? 'Loading…' : 'GET /api/profile'}
		</Button>
	</div>

	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	{#if lastResponse}
		<pre
			class="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">{JSON.stringify(
				lastResponse,
				null,
				2
			)}</pre>
	{/if}
</div>
