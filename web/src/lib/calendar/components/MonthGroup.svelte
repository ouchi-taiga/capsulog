<script lang="ts">
	import type { MonthGroup } from '../types';
	import MonthHeading from './MonthHeading.svelte';
	import ProductCard from './ProductCard.svelte';
	import SectionHeading from '$lib/common/components/SectionHeading.svelte';

	let { group }: { group: MonthGroup } = $props();
</script>

<section class="pt-2">
	{#if group.heading}
		<!-- 価格順は月で切らない。並び順の名前をそのまま見出しにする -->
		<SectionHeading title={group.heading} note="{group.items.length}件" />
	{:else}
		<MonthHeading yearMonth={group.yearMonth} count={group.items.length} />
	{/if}
	<ul class="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
		{#each group.items as item (item.id)}
			<li><ProductCard {item} showYearMonth={group.heading !== undefined} /></li>
		{/each}
	</ul>
</section>
