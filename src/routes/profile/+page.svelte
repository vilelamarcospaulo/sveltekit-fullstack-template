<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import ProfileApiDemo from '$lib/components/profile-api-demo.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Prefill from the form action's echoed-back values on a failed submit
	// (form.values), falling back to the server-loaded profile otherwise.
	// Deliberately a one-time capture into local editable $state (not
	// $derived) — these bind:value to inputs the user types into, so they
	// must be assignable, not a read-only computation.
	// svelte-ignore state_referenced_locally
	let name = $state(form?.values?.name ?? data.profile.name);
	// svelte-ignore state_referenced_locally
	let image = $state(form?.values?.image ?? data.profile.image);
	// svelte-ignore state_referenced_locally
	let birthdate = $state(form?.values?.birthdate ?? data.profile.birthdate);
	// svelte-ignore state_referenced_locally
	let bio = $state(form?.values?.bio ?? data.profile.bio);
	// svelte-ignore state_referenced_locally
	let location = $state(form?.values?.location ?? data.profile.location);

	let submitting = $state(false);

	const errors = $derived(form?.errors ?? {});
</script>

<div class="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Profile</h1>
		<p class="text-sm text-muted-foreground">Manage your public profile information.</p>
	</div>

	{#if form?.success}
		<p class="text-sm text-green-600" role="status">Profile saved.</p>
	{/if}

	<form
		method="post"
		class="flex flex-col gap-5"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<p class="text-sm text-muted-foreground">{data.profile.email}</p>

		<div class="flex flex-col gap-1.5">
			<label for="name" class="text-sm font-medium">
				Name <span aria-hidden="true" class="text-destructive">*</span>
			</label>
			<input
				id="name"
				name="name"
				type="text"
				bind:value={name}
				required
				aria-invalid={!!errors.name}
				aria-describedby={errors.name ? 'name-error' : undefined}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
			{#if errors.name}
				<p id="name-error" role="alert" class="text-sm text-destructive">{errors.name}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="image" class="text-sm font-medium">Avatar URL</label>
			<input
				id="image"
				name="image"
				type="url"
				bind:value={image}
				placeholder="https://example.com/photo.jpg"
				aria-invalid={!!errors.image}
				aria-describedby={errors.image ? 'image-error' : undefined}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
			{#if errors.image}
				<p id="image-error" role="alert" class="text-sm text-destructive">{errors.image}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="birthdate" class="text-sm font-medium">Birthdate</label>
			<input
				id="birthdate"
				name="birthdate"
				type="date"
				bind:value={birthdate}
				aria-invalid={!!errors.birthdate}
				aria-describedby={errors.birthdate ? 'birthdate-error' : undefined}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
			{#if errors.birthdate}
				<p id="birthdate-error" role="alert" class="text-sm text-destructive">
					{errors.birthdate}
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between">
				<label for="bio" class="text-sm font-medium">Bio</label>
				<span
					class="text-xs tabular-nums {bio.length >= 280
						? 'text-destructive'
						: 'text-muted-foreground'}"
					aria-live="polite"
				>
					{bio.length}/280
				</span>
			</div>
			<textarea
				id="bio"
				name="bio"
				bind:value={bio}
				rows={4}
				maxlength={280}
				aria-invalid={!!errors.bio}
				aria-describedby={errors.bio ? 'bio-error' : undefined}
				class="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
			></textarea>
			{#if errors.bio}
				<p id="bio-error" role="alert" class="text-sm text-destructive">{errors.bio}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="location" class="text-sm font-medium">Location</label>
			<input
				id="location"
				name="location"
				type="text"
				bind:value={location}
				placeholder="City, Country"
				aria-invalid={!!errors.location}
				aria-describedby={errors.location ? 'location-error' : undefined}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			/>
			{#if errors.location}
				<p id="location-error" role="alert" class="text-sm text-destructive">
					{errors.location}
				</p>
			{/if}
		</div>

		<div>
			<Button type="submit" disabled={submitting} size="sm">
				{submitting ? 'Saving…' : 'Save profile'}
			</Button>
		</div>
	</form>

	<ProfileApiDemo initial={data.profile} />
</div>
