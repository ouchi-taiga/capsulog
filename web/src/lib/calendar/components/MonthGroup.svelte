<script lang="ts">
	import type { MonthGroup } from '../types';
	import MonthHeading from './MonthHeading.svelte';
	import ProductCard from './ProductCard.svelte';
	import SectionHeading from '$lib/common/components/SectionHeading.svelte';

	let { group }: { group: MonthGroup } = $props();

	/* 遅らせるのは 8 枚目まで。以降は同じ待ち時間で揃え、順番が入れ替わらないようにする */
	const REVEAL_STAGGER = 8;
</script>

<section class="pt-2">
	{#if group.heading}
		<!-- 価格順は月で切らない。並び順の名前をそのまま見出しにする -->
		<SectionHeading title={group.heading} note="{group.count ?? group.items.length}件" />
	{:else}
		<MonthHeading yearMonth={group.yearMonth} count={group.count ?? group.items.length} />
	{/if}
	<ul class="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
		{#each group.items as item, index (item.id)}
			<!-- 生まれた瞬間に一度だけ動く。続きを読んで増えた分にも同じように効く -->
			<li class="reveal" style="animation-delay: {Math.min(index, REVEAL_STAGGER) * 60}ms">
				<ProductCard {item} showYearMonth={group.heading !== undefined} />
			</li>
		{/each}
	</ul>
</section>
