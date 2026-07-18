<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import SignInButton from '$lib/components/sign-in-button.svelte';
	import JobDemo from '$lib/components/job-demo.svelte';

	let { data } = $props();
</script>

<div class="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
	<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Starter Kit</h1>
	<p class="max-w-md text-lg text-muted-foreground">
		A batteries-included SvelteKit fullstack template — Google OAuth sign-in, organization
		multi-tenancy, Drizzle/Postgres via Hyperdrive, and Cloudflare Queues background jobs, deployed
		to Cloudflare Workers.
	</p>

	{#if data.user}
		<Button variant="outline" href="/profile">Edit your profile</Button>
	{:else}
		<SignInButton />
	{/if}
</div>

<div class="mx-auto max-w-md px-4 pb-16 sm:pb-24">
	<div class="rounded-lg border p-6">
		<h2 class="mb-1 text-lg font-semibold">Async Job</h2>
		<p class="mb-4 text-sm text-muted-foreground">
			Enqueue a background job onto Cloudflare Queues, processed asynchronously by a separate
			Cloudflare Worker.
		</p>
		<JobDemo />
	</div>
</div>
