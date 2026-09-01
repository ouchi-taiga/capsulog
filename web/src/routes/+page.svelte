<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { fade, fly } from 'svelte/transition';
	import { MediaQuery, SvelteURLSearchParams } from 'svelte/reactivity';
	import { formatYearMonth } from '$lib/calendar/format';
	import MonthGroup from '$lib/calendar/components/MonthGroup.svelte';

	let { data } = $props();

	// シートの開閉。同一ルート内の遷移ではコンポーネントが生きるので、条件を選んでも閉じない
	let filtersOpen = $state(false);
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	let motionMs = $derived(reduceMotion.current ? 0 : 200);

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
			label: ['先月', '今月', '来月'][index] + ` (${formatYearMonth(yearMonth).slice(5)})`,
			href: link('month', yearMonth),
			on: data.filters.month === yearMonth
		})),
		{
			label: `再来月以降 (${formatYearMonth(data.laterYearMonth).slice(5)}〜)`,
			href: link('month', 'later'),
			on: data.filters.month === 'later'
		},
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

	let sortChips = $derived([
		{ label: '発売時期順', href: link('sort', null), on: data.filters.sort !== 'price' },
		{ label: '価格が安い順', href: link('sort', 'price'), on: data.filters.sort === 'price' }
	]);

	/** 選択中の条件。既定値のままのものは出さない */
	let applied = $derived(
		[
			data.filters.month && {
				label:
					data.filters.month === 'tbd'
						? '発売月未定'
						: data.filters.month === 'later'
							? '再来月以降'
							: formatYearMonth(data.filters.month),
				href: link('month', null)
			},
			data.filters.makerCode && {
				label: data.makers.find((maker) => maker.code === data.filters.makerCode)?.name ?? '',
				href: link('maker', null)
			},
			data.filters.priceBand && {
				label: { '300': '〜300円', '400': '400円台', '500': '500円〜' }[data.filters.priceBand],
				href: link('price', null)
			},
			data.filters.sort === 'price' && { label: '価格が安い順', href: link('sort', null) }
		].filter((chip) => !!chip)
	);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') filtersOpen = false;
	}}
/>

<svelte:head>
	<title>カプセログ | カプセルトイ発売カレンダー</title>
	<meta
		name="description"
		content="カプセルトイの新作をメーカー横断で発売月ごとに見られるカレンダー"
	/>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 pb-16 lg:max-w-5xl">
	<div class="flex items-center gap-2.5 pt-3">
		<form method="GET" action="/" class="flex-1">
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
				class="w-full rounded-full bg-surface px-5 py-2.5 text-sm shadow-clay-sm outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
			/>
		</form>
		<button
			type="button"
			onclick={() => (filtersOpen = !filtersOpen)}
			aria-expanded={filtersOpen}
			aria-label="絞り込み"
			class={[
				'relative grid h-10 w-10 flex-none place-items-center rounded-full',
				filtersOpen ? 'bg-accent text-on-accent shadow-clay-pressed' : 'bg-surface shadow-clay-sm'
			]}
		>
			<!-- スライダーのアイコン -->
			<svg
				width="18"
				height="18"
				viewBox="0 0 18 18"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<path d="M2 5h14M2 13h14" />
				<circle cx="7" cy="5" r="2.2" fill="var(--surface)" />
				<circle cx="12" cy="13" r="2.2" fill="var(--surface)" />
			</svg>
			{#if applied.length > 0 && !filtersOpen}
				<span class="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent" aria-hidden="true"
				></span>
			{/if}
		</button>
	</div>

	{#if filtersOpen}
		<div class="fixed inset-0 z-20">
			<button
				type="button"
				aria-label="絞り込みを閉じる"
				onclick={() => (filtersOpen = false)}
				class="absolute inset-0 bg-[#1c1b1e]/35"
				transition:fade={{ duration: motionMs }}
			></button>
			<div
				role="dialog"
				aria-label="絞り込み"
				transition:fly={{ y: 240, duration: motionMs }}
				class="absolute inset-x-0 bottom-0 mx-auto flex max-h-[75dvh] max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-8"
			>
				<div class="flex items-center justify-between">
					<p class="text-sm font-extrabold">絞り込み</p>
					<button
						type="button"
						aria-label="閉じる"
						onclick={() => (filtersOpen = false)}
						class="grid h-8 w-8 place-items-center rounded-full bg-ground text-faint shadow-clay-sm"
					>
						✕
					</button>
				</div>
				{#each [['発売月', monthChips], ['メーカー', makerChips], ['価格', priceChips], ['並び順', sortChips]] as const as [label, chips] (label)}
					<div>
						<p class="pb-2 text-xs font-bold text-faint">{label}</p>
						<div class="flex flex-wrap gap-2">
							{#each chips as chip (chip.label)}
								<a
									href={chip.href}
									class={[
										'rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap',
										chip.on
											? 'bg-accent text-on-accent shadow-clay-pressed'
											: 'bg-ground text-faint shadow-clay-sm'
									]}
								>
									{chip.label}
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if applied.length > 0}
		<div class="flex flex-wrap gap-2 pt-3" aria-label="選択中の条件">
			{#each applied as chip (chip.label)}
				<a
					href={chip.href}
					class="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-on-accent shadow-clay-pressed"
				>
					{chip.label} ✕
				</a>
			{/each}
		</div>
	{/if}

	{#if data.filters.keyword}
		<p class="pt-3 text-sm text-faint">
			「{data.filters.keyword}」の検索結果 {data.total}件{data.hasMore ? '以上' : ''}
			<!-- link() は resolve() 起点でクエリを組むが、静的解析では追えない -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={link('q', null)} class="ml-2 font-bold text-accent">解除</a>
		</p>
	{/if}

	<div class="pt-5">
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
	</div>
</main>
