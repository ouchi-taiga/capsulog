<script lang="ts">
	import type { MonthGroup } from '../types';
	import { formatYearMonth } from '../format';
	import ProductCard from './ProductCard.svelte';

	let { group }: { group: MonthGroup } = $props();
</script>

<section>
	<h2 class="flex items-baseline gap-2.5 px-1 pt-2 pb-2.5">
		<span class="font-extrabold">{formatYearMonth(group.yearMonth)}</span>
		<span class="text-xs text-faint">{group.items.length}件</span>
		<span class="deco-wave ml-1.5 h-2 flex-1" aria-hidden="true"></span>
	</h2>
	<ul class="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
		{#each group.items as item (item.id)}
			<li><ProductCard {item} /></li>
		{/each}
	</ul>
</section>
