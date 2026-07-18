<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const canManage = $derived(data.viewerRole === 'owner' || data.viewerRole === 'admin');

	let email = $state('');
	let role = $state<'admin' | 'member'>('member');
	let pending = $state(false);
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
