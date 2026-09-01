<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { formatYearMonth } from '$lib/calendar/format';
	import MonthGroup from '$lib/calendar/components/MonthGroup.svelte';

	let { data } = $props();

	/** 現在の URL から1つのパラメータだけ差し替えたリンクを作る */
	function link(key: string, value: string | null): string {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (value === null) params.delete(key);
		else params.set(key, value);
		const query = params.toString();
		return query ? `?${query}` : resolve('/');
	}

	let monthChips = $derived([
		{ label: '今月・来月', href: link('month', null), on: data.filters.month === null },
		...data.monthOptions.map((yearMonth, index) => ({
			label: ['今月', '来月', '再来月'][index] + ` (${formatYearMonth(yearMonth).slice(5)})`,
			href: link('month', yearMonth),
			on: data.filters.month === yearMonth
		})),
		{ label: '未定', href: link('month', 'tbd'), on: data.filters.month === 'tbd' }
	]);

	let makerChips = $derived([
		{ label: 'すべて', href: link('maker', null), on: !data.filters.makerCode },
		...data.makers.map((maker) => ({
			label: maker.name,
			href: link('maker', maker.code),
			on: data.filters.makerCode === maker.code
		}))
	]);

	let priceChips = $derived(
		(
			[
				['300', '〜300円'],
				['400', '400円台'],
				['500', '500円〜']
			] as const
		).map(([value, label]) => ({
			label,
			href: link('price', data.filters.priceBand === value ? null : value),
			on: data.filters.priceBand === value
		}))
	);
</script>

<svelte:head>
	<title>カプセログ | カプセルトイ発売カレンダー</title>
	<meta
		name="description"
		content="カプセルトイの新作をメーカー横断で発売月ごとに見られるカレンダー"
	/>
</svelte:head>

<header class="deco-dots sticky top-0 z-10 bg-ground/95 px-4 pt-5 pb-3 backdrop-blur-sm">
	<div class="mx-auto flex max-w-2xl items-center justify-between">
		<h1 class="text-xl font-extrabold">カプセ<span class="text-accent">ログ</span></h1>
		<form method="GET" action="/" class="flex items-center">
			{#if data.filters.month}<input type="hidden" name="month" value={data.filters.month} />{/if}
			{#if data.filters.makerCode}<input
					type="hidden"
					name="maker"
					value={data.filters.makerCode}
				/>{/if}
			{#if data.filters.priceBand}<input
					type="hidden"
					name="price"
					value={data.filters.priceBand}
				/>{/if}
			<input
				type="search"
				name="q"
				value={data.filters.keyword ?? ''}
				placeholder="商品名で検索"
				class="w-40 rounded-full bg-surface px-4 py-1.5 text-sm shadow-clay-sm outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
			/>
		</form>
	</div>
</header>

<main class="mx-auto max-w-2xl px-4 pb-16">
	<nav class="flex flex-col gap-2.5 pt-3 pb-5" aria-label="絞り込み">
		{#each [monthChips, makerChips, priceChips] as chips, index (index)}
			<div class="-mx-4 flex scrollbar-none gap-2 overflow-x-auto px-4">
				{#each chips as chip (chip.label)}
					<a
						href={chip.href}
						class={[
							'flex-none rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap',
							chip.on
								? 'bg-accent text-on-accent shadow-clay-pressed'
								: 'bg-ground text-faint shadow-clay-sm'
						]}
					>
						{chip.label}
					</a>
				{/each}
			</div>
		{/each}
	</nav>

	{#if data.filters.keyword}
		<p class="pb-3 text-sm text-faint">
			「{data.filters.keyword}」の検索結果 {data.total}件{data.hasMore ? '以上' : ''}
			<!-- link() は resolve() 起点でクエリを組むが、静的解析では追えない -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={link('q', null)} class="ml-2 font-bold text-accent">解除</a>
		</p>
	{/if}

	{#if data.groups.length === 0}
		<p class="py-16 text-center text-sm text-faint">この条件の商品はありません</p>
	{:else}
		<div class="flex flex-col gap-6">
			{#each data.groups as group (group.yearMonth ?? 'tbd')}
				<MonthGroup {group} />
			{/each}
		</div>
		{#if data.hasMore}
			<p class="pt-6 text-center text-xs text-faint">
				表示は{data.total}件まで。絞り込みか検索で狭められます
			</p>
		{/if}
	{/if}
</main>

<style>
	.scrollbar-none {
		scrollbar-width: none;
	}
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
</style>
