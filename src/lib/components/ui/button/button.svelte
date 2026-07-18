<script lang="ts" module>
	import { type VariantProps, cva } from 'class-variance-authority';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	export const buttonVariants = cva(
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
		{
			variants: {
				variant: {
					default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
					destructive:
						'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
					outline:
						'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
					secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
					ghost: 'hover:bg-accent hover:text-accent-foreground',
					link: 'text-primary underline-offset-4 hover:underline'
				},
				size: {
					default: 'h-9 px-4 py-2 has-[>svg]:px-3',
					sm: 'h-8 rounded-md px-3 has-[>svg]:px-2.5',
					lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
					icon: 'size-9'
				}
			},
			defaultVariants: {
				variant: 'default',
				size: 'default'
			}
		}
	);

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			ref?: HTMLButtonElement | HTMLAnchorElement | null;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href,
		type = 'button',
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href !== undefined}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is a generic prop (external links, mailto:, or an already-resolved path), not a hardcoded internal route -->
	<a bind:this={ref} class={cn(buttonVariants({ variant, size }), className)} {href} {...restProps}>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
