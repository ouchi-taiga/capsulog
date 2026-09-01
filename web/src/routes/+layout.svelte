<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/common/components/AppHeader.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<AppHeader />
{@render children()}
