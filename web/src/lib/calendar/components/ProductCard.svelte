<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProductListItem } from '../types';
	import { capsuleColorAt } from '../capsule';
	import { formatDetail, formatYearMonth } from '../format';
	import CapsuleBullet from './CapsuleBullet.svelte';
	import MakerTag from './MakerTag.svelte';

	// showYearMonth は月で切らない並びのとき。見出しに月が出ないため、カードに出す
	let { item, showYearMonth = false }: { item: ProductListItem; showYearMonth?: boolean } =
		$props();

	let detail = $derived(formatDetail(item.precision, item.detail));

	/* 並べるカプセルの数。多い商品は溢れるため打ち切り、残りは数で見せる */
	const SHOWN_CAPSULES = 8;
	let shown = $derived(Math.min(item.totalVariants ?? 0, SHOWN_CAPSULES));
	let rest = $derived((item.totalVariants ?? 0) - shown);
</script>

<a
	href={resolve('/products/[id]', { id: String(item.id) })}
	class="pressable relative flex h-full flex-col overflow-hidden rounded-3xl bg-surface px-4 py-3.5 shadow-clay"
>
	<span class="deco absolute -top-3 -right-3 h-10 w-10 opacity-15" aria-hidden="true"></span>
	<div><MakerTag code={item.makerCode} name={item.makerName} /></div>
	<!-- 常に2行分を確保してカードの高さを揃える。1列のときだけ上下中央に置く -->
	<h3
		class="mt-2 mb-1.5 min-h-[2lh] content-center text-body leading-relaxed font-bold sm:content-start"
	>
		<span class="line-clamp-2">{item.name}</span>
	</h3>
	{#if item.totalVariants !== null}
		<!-- 全何種をカプセルの数で見せる。数字より一目で量が分かる -->
		<div
			class="mt-1.5 mb-2 flex items-end gap-0.5"
			role="img"
			aria-label="全{item.totalVariants}種"
		>
			{#each { length: shown }, index (index)}
				<CapsuleBullet color={capsuleColorAt(item.id, index)} />
			{/each}
			{#if rest > 0}<span class="ml-1 text-note font-bold text-faint">+{rest}</span>{/if}
		</div>
	{/if}
	<div class="mt-auto flex gap-3.5 text-note font-bold text-faint tabular-nums">
		<span>{item.price === null ? '価格不明' : `¥${item.price}`}</span>
		{#if item.totalVariants !== null}<span>全{item.totalVariants}種</span>{/if}
		{#if showYearMonth}
			<span>{formatYearMonth(item.yearMonth)}{detail ?? ''}</span>
		{:else if detail}
			<span>{detail}</span>
		{/if}
	</div>
</a>

<style>
	/* カードの隅の装飾。リストの偶数行は円でなく四角にする */
	.deco {
		background: var(--accent);
		border-radius: 50%;
	}
	:global(li:nth-child(even)) .deco {
		background: var(--sub);
		border-radius: 0;
		transform: rotate(24deg);
	}
</style>
