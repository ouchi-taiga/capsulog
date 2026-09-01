<script lang="ts">
	import type { MonthGroup } from '../types';
	import { formatYearMonth } from '../format';
	import ProductCard from './ProductCard.svelte';
	import SectionHeading from '$lib/common/components/SectionHeading.svelte';

	let { group }: { group: MonthGroup } = $props();
</script>

<section class="pt-2">
	<SectionHeading title={formatYearMonth(group.yearMonth)} note="{group.items.length}件" />
	<ul class="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
		{#each group.items as item (item.id)}
			<li><ProductCard {item} /></li>
		{/each}
	</ul>
</section>
