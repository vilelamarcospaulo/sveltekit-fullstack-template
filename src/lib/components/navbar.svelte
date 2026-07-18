<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient, signOut } from '$lib/auth-client';
	import SignInButton from '$lib/components/sign-in-button.svelte';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger,
		DropdownMenuGroup,
		DropdownMenuGroupHeading
	} from '$lib/components/ui/dropdown-menu';

	type NavUser = {
		name: string;
		email: string;
		image?: string | null | undefined;
	};

	let { user }: { user: NavUser | null } = $props();

	// authClient.useListOrganizations()/useActiveOrganization() return
	// better-auth's nanostore atoms directly (see
	// node_modules/better-auth/dist/client/svelte/index.mjs — each `use*`
	// hook is just `() => value`, not a fresh call per render). Nanostores
	// implement the same subscribe-contract Svelte stores expect, so `$`
	// auto-subscription works directly on them without any adapter. Each
	// atom's value is `{ data, error, isPending, isRefetching, refetch }` —
	// verified against node_modules/better-auth/dist/client/query.d.mts's
	// `AuthQueryAtom<T>`.
	const organizations = authClient.useListOrganizations();
	const activeOrganization = authClient.useActiveOrganization();

	let signingOut = $state(false);

	function initials(name: string, email: string): string {
		const trimmed = name.trim();
		if (trimmed) {
			const words = trimmed.split(/\s+/).filter(Boolean);
			if (words.length >= 2) {
				return (words[0][0] + words[words.length - 1][0]).toUpperCase();
			}
			return trimmed.slice(0, 2).toUpperCase();
		}
		const localPart = email.split('@')[0];
		return localPart ? localPart[0].toUpperCase() : '?';
	}

	async function handleSwitchOrganization(organizationId: string) {
		await authClient.organization.setActive({ organizationId });
		await invalidateAll();
	}

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

<header
	class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
	<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
		<a href={resolve('/')} class="font-semibold">Starter Kit</a>

		<div class="flex items-center gap-2">
			{#if user === null}
				<SignInButton />
			{:else}
				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label="User menu"
						class="flex items-center gap-2 rounded-lg py-1 pr-1 pl-2 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
					>
						<span class="hidden w-32 flex-col text-right leading-tight sm:flex">
							<span class="truncate text-sm font-medium">{user.name}</span>
							{#if $activeOrganization.data}
								<span class="truncate text-xs text-muted-foreground">
									{$activeOrganization.data.name}
								</span>
							{/if}
						</span>
						<Avatar class="size-8 shrink-0">
							<AvatarImage src={user.image ?? undefined} alt={user.name} />
							<AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
						</Avatar>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" class="w-72">
						<div class="flex flex-col gap-0.5 px-1.5 py-1.5">
							<span class="text-sm font-medium">{user.name}</span>
							<span class="text-xs text-muted-foreground">{user.email}</span>
						</div>
						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuGroupHeading class="text-xs font-medium text-muted-foreground">
								Organizations
							</DropdownMenuGroupHeading>
							{#each $organizations.data ?? [] as org (org.id)}
								<DropdownMenuItem onclick={() => handleSwitchOrganization(org.id)}>
									<span class="flex-1 truncate">{org.name}</span>
									{#if $activeOrganization.data?.id === org.id}
										<svg
											class="size-4 text-muted-foreground"
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											aria-hidden="true"
										>
											<path d="M20 6 9 17l-5-5" />
										</svg>
									{/if}
								</DropdownMenuItem>
							{/each}
						</DropdownMenuGroup>

						<DropdownMenuItem class="text-primary focus:text-primary">
							<a href={resolve('/org/new')} class="flex w-full items-center gap-1.5 font-medium">
								<svg
									class="size-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M5 12h14" />
									<path d="M12 5v14" />
								</svg>
								New organization
							</a>
						</DropdownMenuItem>

						<DropdownMenuSeparator />
						<DropdownMenuItem>
							<!-- /profile doesn't exist as a route in this worktree yet (owned by the
								profile-CRUD branch, built in parallel) — resolve() can't type-check a
								route id this branch's manifest doesn't have. Plain href until merge. -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href="/profile" class="w-full">Profile</a>
						</DropdownMenuItem>
						{#if $activeOrganization.data}
							<DropdownMenuItem>
								<a
									href={resolve('/org/[slug]', { slug: $activeOrganization.data.slug })}
									class="w-full"
								>
									Organization settings
								</a>
							</DropdownMenuItem>
						{/if}

						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onclick={handleSignOut} disabled={signingOut}>
							{signingOut ? 'Signing out…' : 'Sign out'}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			{/if}
		</div>
	</div>
</header>
