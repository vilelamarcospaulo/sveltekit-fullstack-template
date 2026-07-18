<script lang="ts">
	// Live demo of calling this app's own JSON API (src/routes/api/profile/+server.ts)
	// from the client, the SvelteKit counterpart to the Next.js sibling
	// template's profile-form.tsx (which saves via a client-side PUT to
	// /api/profile rather than a form action). The main profile form on this
	// page still saves via a SvelteKit form action — this is a clearly
	// separate, self-contained demonstration of the alternate HTTP-call path,
	// not a replacement for it.
	import { apiFetch, ApiError, AuthError } from '$lib/api-client';
	import { Button } from '$lib/components/ui/button';
	import type { ProfileView } from '$lib/types/api';

	let { initial }: { initial: ProfileView } = $props();

	// One-time capture into editable local state, same pattern (and same
	// reason) as +page.svelte's form fields — this binds to an input, so it
	// must be assignable, not a read-only $derived.
	// svelte-ignore state_referenced_locally
	let bio = $state(initial.bio ?? '');
	let lastResponse = $state<ProfileView | null>(null);
	let error = $state<string | null>(null);
	let pending = $state<'get' | 'put' | null>(null);

	async function handleGet() {
		pending = 'get';
		error = null;
		try {
			lastResponse = await apiFetch<ProfileView>('/api/profile');
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Network error. Please try again.';
		} finally {
			pending = null;
		}
	}

	async function handlePut() {
		pending = 'put';
		error = null;
		try {
			lastResponse = await apiFetch<ProfileView>('/api/profile', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				// Full payload required — updateProfile() validates the whole
				// input object, not a partial patch. Everything but bio comes
				// from the profile already loaded on this page.
				body: JSON.stringify({
					name: initial.name,
					image: initial.image,
					birthdate: initial.birthdate,
					bio,
					location: initial.location
				})
			});
		} catch (err) {
			if (err instanceof AuthError) {
				error = 'Your session expired — sign in again to use this demo.';
			} else if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Network error. Please try again.';
			}
		} finally {
			pending = null;
		}
	}
</script>

<div class="flex flex-col gap-3 rounded-lg border p-4">
	<div>
		<h2 class="text-sm font-semibold">Try the API directly</h2>
		<p class="text-xs text-muted-foreground">
			The same profile data via <code class="font-mono">GET</code>/<code class="font-mono"
				>PUT /api/profile</code
			>
			— a JSON API calling into the same use case as the form above, called here with a plain client-side
			<code class="font-mono">fetch</code>.
		</p>
	</div>

	<div class="flex flex-wrap items-end gap-3">
		<div class="flex flex-1 flex-col gap-1.5">
			<label for="api-demo-bio" class="text-xs font-medium">Bio (sent via PUT)</label>
			<input
				id="api-demo-bio"
				type="text"
				bind:value={bio}
				class="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
			/>
		</div>
		<Button variant="outline" size="sm" onclick={handleGet} disabled={pending !== null}>
			{pending === 'get' ? 'Loading…' : 'GET /api/profile'}
		</Button>
		<Button size="sm" onclick={handlePut} disabled={pending !== null}>
			{pending === 'put' ? 'Saving…' : 'PUT /api/profile'}
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
