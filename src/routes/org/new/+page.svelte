<script lang="ts">
	import { enhance } from '$app/forms';
	import { slugify } from '$lib/internal/domain/organization';
	import { Button } from '$lib/components/ui/button';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let name = $state('');
	let slug = $state('');
	// Once the user edits the slug directly, stop overwriting it from the name.
	let slugEdited = $state(false);
	let pending = $state(false);

	function handleNameInput(value: string) {
		name = value;
		if (!slugEdited) {
			slug = slugify(value);
		}
	}
</script>

<svelte:head>
	<title>New organization — Starter Kit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-24">
	<div class="flex flex-col gap-1.5 text-center">
		<h1 class="text-2xl font-semibold tracking-tight">New organization</h1>
		<p class="text-sm text-muted-foreground">Create a workspace to collaborate with teammates.</p>
	</div>

	<form
		method="POST"
		class="flex flex-col gap-4"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update();
				pending = false;
			};
		}}
	>
		<div class="flex flex-col gap-1.5">
			<label for="new-org-name" class="text-sm font-medium">Name</label>
			<input
				id="new-org-name"
				name="name"
				value={name}
				oninput={(e) => handleNameInput(e.currentTarget.value)}
				class="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
				aria-invalid={!!form?.errors?.name}
				aria-describedby={form?.errors?.name ? 'new-org-name-error' : undefined}
			/>
			{#if form?.errors?.name}
				<p id="new-org-name-error" role="alert" class="text-sm text-destructive">
					{form.errors.name}
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="new-org-slug" class="text-sm font-medium">Slug</label>
			<input
				id="new-org-slug"
				name="slug"
				value={slug}
				oninput={(e) => {
					slugEdited = true;
					slug = e.currentTarget.value;
				}}
				class="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
				aria-invalid={!!form?.errors?.slug}
				aria-describedby={form?.errors?.slug ? 'new-org-slug-error' : undefined}
			/>
			{#if form?.errors?.slug}
				<p id="new-org-slug-error" role="alert" class="text-sm text-destructive">
					{form.errors.slug}
				</p>
			{/if}
		</div>

		<div>
			<Button type="submit" size="sm" disabled={pending}>
				{pending ? 'Creating…' : 'Create organization'}
			</Button>
		</div>
	</form>
</div>
