<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatRelease, releaseStatus } from '$lib/calendar/format';
	import CapsuleRow from '$lib/calendar/components/CapsuleRow.svelte';
	import MakerTag from '$lib/calendar/components/MakerTag.svelte';
	import ProductCard from '$lib/calendar/components/ProductCard.svelte';

	let { data } = $props();
	let product = $derived(data.product);
	let status = $derived(releaseStatus(product.yearMonth, product.precision, product.detail));
</script>

<svelte:head>
	<title>{product.name} | カプセログ</title>
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-3 pb-28">
	<div>
		<div class="flex items-center gap-2">
			<MakerTag code={product.makerCode} name={product.makerName} />
			{#if status}
				<span
					class={[
						'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
						status === '発売済み' ? 'bg-ground text-faint shadow-clay-sm' : 'bg-sub text-white'
					]}
				>
					{status}
				</span>
			{/if}
		</div>
		<h1 class="mt-2.5 text-xl leading-relaxed font-extrabold text-balance">{product.name}</h1>
	</div>

	{#if product.totalVariants !== null}
		<CapsuleRow
			count={product.totalVariants}
			hasSecret={product.variants.some((variant) => variant.isSecret === 1)}
			seed={product.id}
		/>
	{/if}

	<dl class="grid grid-cols-3 gap-2.5">
		{#each [['発売', formatRelease(product.yearMonth, product.precision, product.detail)], ['価格', product.price === null ? '不明' : `¥${product.price}`], ['種類', product.totalVariants === null ? '—' : `全${product.totalVariants}種`]] as [label, value] (label)}
			<div class="rounded-2xl bg-surface px-2 py-3 text-center shadow-clay">
				<dt class="text-[10.5px] font-bold text-faint">{label}</dt>
				<dd class="mt-0.5 text-sm font-extrabold tabular-nums">{value}</dd>
			</div>
		{/each}
	</dl>

	{#if product.variants.length > 0}
		<section class="rounded-3xl bg-surface p-4 shadow-clay">
			<h2 class="flex items-baseline gap-2 pb-2.5 text-xs font-bold text-faint">
				ラインナップ
				<span class="deco-wave h-2 flex-1" aria-hidden="true"></span>
			</h2>
			<ul class="flex flex-col gap-2">
				{#each product.variants as variant (variant.name)}
					<li
						class={[
							'flex items-center gap-2.5 text-[13.5px] font-bold',
							variant.isSecret ? 'text-accent' : ''
						]}
					>
						<span
							class={[
								'h-2 w-2 flex-none rounded-full opacity-70',
								variant.isSecret ? 'bg-accent' : 'bg-sub'
							]}
							aria-hidden="true"
						></span>
						{variant.name}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<a
		href={product.officialUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="rounded-full bg-accent py-3 text-center text-sm font-bold text-on-accent shadow-clay-pressed"
	>
		公式サイトで見る ↗
	</a>
	<p class="text-center text-[11px] text-faint">情報の出典はメーカー公式サイト</p>

	{#if data.series.length > 0}
		<section class="pt-2">
			<h2 class="flex items-baseline gap-2.5 px-1 pb-2.5">
				<span class="text-sm font-extrabold">シリーズの商品</span>
				<span class="deco-wave ml-1.5 h-2 flex-1" aria-hidden="true"></span>
			</h2>
			<ul class="flex flex-col gap-4 sm:grid sm:grid-cols-2">
				{#each data.series as item (item.id)}
					<li><ProductCard {item} /></li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<a
	href={resolve('/')}
	class="fixed bottom-5 left-4 z-10 rounded-full bg-surface px-5 py-3 text-sm font-extrabold shadow-clay"
>
	← カレンダー
</a>
