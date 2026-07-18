<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { signOut } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import SignInButton from '$lib/components/sign-in-button.svelte';

	let { data } = $props();

	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		try {
			await signOut();
			await invalidateAll();
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
	<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Starter Kit</h1>
	<p class="max-w-md text-lg text-muted-foreground">
		A batteries-included SvelteKit fullstack template — foundation phase: Google OAuth sign-in,
		Drizzle/Postgres via Hyperdrive, deployed to Cloudflare Workers.
	</p>

	{#if data.user}
		<p class="text-sm">
			Signed in as <span class="font-medium">{data.user.name}</span>
			({data.user.email})
		</p>
		<Button variant="outline" onclick={handleSignOut} disabled={signingOut}>
			{signingOut ? 'Signing out…' : 'Sign out'}
		</Button>
	{:else}
		<SignInButton />
	{/if}
</div>
