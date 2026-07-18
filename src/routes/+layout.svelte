<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/navbar.svelte';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>Starter Kit</title>
	<link rel="icon" href={favicon} />
</svelte:head>
<Navbar user={data.user} />
{@render children()}
