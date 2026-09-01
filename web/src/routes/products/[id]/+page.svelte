<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatRelease } from '$lib/calendar/format';
	import MakerTag from '$lib/calendar/components/MakerTag.svelte';

	let { data } = $props();
	let product = $derived(data.product);
</script>

<svelte:head>
	<title>{product.name} | カプセログ</title>
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-3 pb-28">
	<div>
		<MakerTag code={product.makerCode} name={product.makerName} />
		<h1 class="mt-2.5 text-xl leading-relaxed font-extrabold text-balance">{product.name}</h1>
	</div>

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
</main>

<a
	href={resolve('/')}
	class="fixed bottom-5 left-4 z-10 rounded-full bg-surface px-5 py-3 text-sm font-extrabold shadow-clay"
>
	← カレンダー
</a>
