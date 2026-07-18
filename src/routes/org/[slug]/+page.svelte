<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const canManage = $derived(data.viewerRole === 'owner' || data.viewerRole === 'admin');

	let email = $state('');
	let role = $state<'admin' | 'member'>('member');
	let pending = $state(false);

	// One-time capture into local state — bind:value needs an assignable
	// $state, not $derived. The $effect below re-syncs on later navigations.
	// svelte-ignore state_referenced_locally
	let editName = $state(data.organization.name);
	// svelte-ignore state_referenced_locally
	let editSlug = $state(data.organization.slug);
	let editPending = $state(false);

	// SvelteKit doesn't remount on a slug-only param change (e.g. this form's
	// own rename redirect), so the $state initializers above only run once.
	// Re-sync when `data.organization` changes so a rename doesn't leave
	// stale values.
	$effect(() => {
		editName = data.organization.name;
		editSlug = data.organization.slug;
	});
</script>

<svelte:head>
	<title>{data.organization.name} — Starter Kit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">{data.organization.name}</h1>
		<p class="text-sm text-muted-foreground">
			{data.organization.slug} · your role: {data.viewerRole}
		</p>
	</div>

	{#if canManage}
		<div class="flex flex-col gap-3 border-t pt-6">
			<h2 class="text-lg font-medium">Organization settings</h2>
			<form
				method="POST"
				action="?/updateOrganization"
				class="flex flex-col gap-4"
				use:enhance={() => {
					editPending = true;
					return async ({ update }) => {
						await update();
						editPending = false;
					};
				}}
			>
				<input type="hidden" name="organizationId" value={data.organization.id} />

				<div class="flex flex-col gap-1.5">
					<label for="edit-org-name" class="text-sm font-medium">Name</label>
					<input
						id="edit-org-name"
						name="name"
						bind:value={editName}
						class="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
						aria-invalid={!!form?.updateErrors?.name}
						aria-describedby={form?.updateErrors?.name ? 'edit-org-name-error' : undefined}
					/>
					{#if form?.updateErrors?.name}
						<p id="edit-org-name-error" role="alert" class="text-sm text-destructive">
							{form.updateErrors.name}
						</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="edit-org-slug" class="text-sm font-medium">Slug</label>
					<input
						id="edit-org-slug"
						name="slug"
						bind:value={editSlug}
						class="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
						aria-invalid={!!form?.updateErrors?.slug}
						aria-describedby={form?.updateErrors?.slug ? 'edit-org-slug-error' : undefined}
					/>
					{#if form?.updateErrors?.slug}
						<p id="edit-org-slug-error" role="alert" class="text-sm text-destructive">
							{form.updateErrors.slug}
						</p>
					{/if}
				</div>

				{#if form?.updateErrors?.form}
					<p role="alert" class="text-sm text-destructive">{form.updateErrors.form}</p>
				{/if}

				<div>
					<Button type="submit" size="sm" disabled={editPending}>
						{editPending ? 'Saving…' : 'Save changes'}
					</Button>
				</div>
			</form>
		</div>
	{/if}

	<div class="flex flex-col gap-3">
		<h2 class="text-lg font-medium">Members</h2>
		<p class="text-sm text-muted-foreground">{data.members.length} member(s)</p>

		<div class="flex flex-col gap-3">
			{#each data.members as member (member.id)}
				<div class="flex items-center justify-between gap-3 border-b py-2">
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-medium">{member.user.name}</span>
						<span class="text-xs text-muted-foreground">{member.user.email}</span>
					</div>
					<span class="text-xs text-muted-foreground">{member.role}</span>
				</div>
			{/each}
		</div>
	</div>

	{#if canManage}
		<div class="flex flex-col gap-3 border-t pt-6">
			<h2 class="text-lg font-medium">Add a member</h2>
			<form
				method="POST"
				action="?/addMember"
				class="flex flex-col gap-3"
				use:enhance={() => {
					pending = true;
					return async ({ update }) => {
						await update();
						pending = false;
						if (form?.addSuccess) {
							email = '';
						}
					};
				}}
			>
				<input type="hidden" name="organizationId" value={data.organization.id} />

				<div class="flex flex-col gap-1.5">
					<label for="add-member-email" class="text-sm font-medium">
						Add an existing member by email
					</label>
					<div class="flex gap-2">
						<input
							id="add-member-email"
							name="email"
							type="email"
							bind:value={email}
							placeholder="teammate@example.com"
							class="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
							aria-invalid={!!form?.addErrors?.email}
							aria-describedby={form?.addErrors?.email ? 'add-member-error' : undefined}
						/>
						<select
							name="role"
							bind:value={role}
							aria-label="Role for new member"
							class="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
						>
							<option value="member">member</option>
							<option value="admin">admin</option>
						</select>
						<Button type="submit" size="sm" disabled={pending}>
							{pending ? 'Adding…' : 'Add'}
						</Button>
					</div>
					{#if form?.addErrors?.email}
						<p id="add-member-error" role="alert" class="text-sm text-destructive">
							{form.addErrors.email}
						</p>
					{/if}
					{#if form?.addErrors?.role}
						<p role="alert" class="text-sm text-destructive">{form.addErrors.role}</p>
					{/if}
					{#if form?.addErrors?.form}
						<p role="alert" class="text-sm text-destructive">{form.addErrors.form}</p>
					{/if}
					{#if form?.addSuccess}
						<p class="text-sm text-green-600 dark:text-green-500">Member added.</p>
					{/if}
				</div>
			</form>
		</div>
	{/if}
</div>
