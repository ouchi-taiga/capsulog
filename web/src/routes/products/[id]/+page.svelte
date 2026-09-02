<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatRelease, releaseStatus } from '$lib/calendar/format';
	import CapsuleBullet from '$lib/calendar/components/CapsuleBullet.svelte';
	import CapsuleRow from '$lib/calendar/components/CapsuleRow.svelte';
	import { capsuleColorAt } from '$lib/calendar/capsule';
	import MakerTag from '$lib/calendar/components/MakerTag.svelte';
	import ProductCard from '$lib/calendar/components/ProductCard.svelte';
	import SectionHeading from '$lib/common/components/SectionHeading.svelte';

	let { data } = $props();
	let product = $derived(data.product);
	let status = $derived(releaseStatus(product.yearMonth, product.precision, product.detail));
	let release = $derived(formatRelease(product.yearMonth, product.precision, product.detail));
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
						'inline-block rounded-full px-2.5 py-0.5 text-note font-extrabold',
						status === '発売済み' ? 'bg-ground text-faint shadow-clay-sm' : 'bg-sub text-white'
					]}
				>
					{status}
				</span>
			{/if}
		</div>
		<h1 class="mt-2.5 text-title leading-relaxed font-extrabold text-balance">{product.name}</h1>
	</div>

	{#if product.totalVariants !== null}
		<CapsuleRow
			count={product.totalVariants}
			hasSecret={product.variants.some((variant) => variant.isSecret === 1)}
			seed={product.id}
		/>
	{/if}

	<ul class="grid grid-cols-3 gap-2.5">
		{#each [product.yearMonth ? `${release}発売` : release, product.price === null ? '価格不明' : `¥${product.price}`, product.totalVariants === null ? '種類数不明' : `全${product.totalVariants}種`] as value (value)}
			<!-- 2行分を確保して上下中央に置く。折り返しで箱の高さを変えない -->
			<li
				class="min-h-[2lh] content-center rounded-2xl bg-surface px-2 py-4 text-center text-body font-extrabold tabular-nums shadow-clay"
			>
				{value}
			</li>
		{/each}
	</ul>

	{#if product.variants.length > 0}
		<section>
			<SectionHeading title="ラインナップ" />
			<ul class="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-clay">
				{#each product.variants as variant, index (variant.name)}
					<li
						class={[
							'flex items-center gap-2.5 text-body font-bold',
							variant.isSecret ? 'text-accent' : ''
						]}
					>
						<!-- 上のカプセル並びと同じ式で色を決め、n個目と n行目を揃える -->
						<CapsuleBullet
							color={capsuleColorAt(product.id, index)}
							secret={variant.isSecret === 1}
						/>
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
		class="pressable rounded-full bg-accent py-3 text-center text-body font-bold text-on-accent shadow-clay-pressed"
	>
		公式サイトで見る ↗
	</a>
	<p class="text-center text-note text-faint">情報の出典はメーカー公式サイト</p>

	{#if data.series.length > 0}
		<section class="pt-2">
			<SectionHeading title="シリーズの商品" />
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
	class="pressable fixed bottom-5 left-4 z-10 rounded-full bg-surface px-5 py-3 text-body font-extrabold shadow-clay"
>
	← カレンダー
</a>
