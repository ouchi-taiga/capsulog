<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProductListItem } from '../types';
	import { formatDetail } from '../format';
	import MakerTag from './MakerTag.svelte';

	let { item }: { item: ProductListItem } = $props();

	let detail = $derived(formatDetail(item.precision, item.detail));
</script>

<a
	href={resolve('/products/[id]', { id: String(item.id) })}
	class="relative block overflow-hidden rounded-3xl bg-surface px-4 py-3.5 shadow-clay"
>
	<span class="deco absolute -top-3 -right-3 h-10 w-10 opacity-15" aria-hidden="true"></span>
	<MakerTag code={item.makerCode} name={item.makerName} />
	<h3 class="mt-2 mb-1.5 text-[15px] leading-relaxed font-bold">{item.name}</h3>
	<div class="flex gap-3.5 text-xs font-bold text-faint tabular-nums">
		<span>{item.price === null ? '価格未定' : `¥${item.price}`}</span>
		{#if item.totalVariants !== null}<span>全{item.totalVariants}種</span>{/if}
		{#if detail}<span>{detail}</span>{/if}
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
