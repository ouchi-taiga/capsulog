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

	function monthChip(label: string, yearMonth: string) {
		return {
			label: `${label} (${formatYearMonth(yearMonth).slice(5)})`,
			href: link('month', yearMonth),
			on: data.filters.month === yearMonth
		};
	}

	// 時系列順に並べ、既定の「今月・来月」を先月と今月の間に挟む
	let monthChips = $derived([
		{
			label: `先々月以前 (〜${formatYearMonth(data.earlierYearMonth).slice(5)})`,
			href: link('month', 'earlier'),
			on: data.filters.month === 'earlier'
		},
		monthChip('先月', data.previousYearMonth),
		{ label: '今月・来月', href: link('month', null), on: data.filters.month === null },
		monthChip('今月', data.thisYearMonth),
		monthChip('来月', data.nextYearMonth),
		{
			label: `再来月以降 (${formatYearMonth(data.laterYearMonth).slice(5)}〜)`,
			href: link('month', 'later'),
			on: data.filters.month === 'later'
		},
		{ label: '不明', href: link('month', 'unknown'), on: data.filters.month === 'unknown' }
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

	// これから発売の月を選んでいるか。空だったときの案内を変える
	let isFutureMonth = $derived(
		data.filters.month === 'later' ||
			(!!data.filters.month && data.filters.month > data.thisYearMonth)
	);

	/** 選択中の条件。既定値のままのものは出さない */
	let applied = $derived(
		[
			data.filters.month && {
				label:
					{ unknown: '発売月不明', later: '再来月以降', earlier: '先々月以前' }[
						data.filters.month
					] ?? formatYearMonth(data.filters.month),
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

<!-- 上部の色エリア。固定ヘッダーの分だけ上に余白を取り、中身が高さを決める -->
<div data-hero class="relative overflow-hidden bg-accent px-4 pt-20 pb-7">
	<div class="relative mx-auto max-w-2xl lg:max-w-5xl">
		<!-- 円とカプセルは列の内側に置く。画面端に寄せると偶然そこにある形に見える -->
		<div
			class="absolute top-2 -right-24 h-56 w-56 rounded-full bg-white/15"
			aria-hidden="true"
		></div>
		<div class="absolute -top-4 right-[10%] hidden -rotate-12 sm:block" aria-hidden="true">
			<svg width="60" height="69" viewBox="0 0 40 46">
				<path d="M4 24 h32 v4 a16 16 0 0 1 -32 0 z" fill="#fffefd" />
				<path d="M4 24 a16 16 0 0 1 32 0 z" fill="#64bfae" />
				<ellipse
					cx="13"
					cy="14"
					rx="4.5"
					ry="6.5"
					fill="#ffffff"
					opacity="0.4"
					transform="rotate(-25 13 14)"
				/>
			</svg>
		</div>
		<div class="absolute top-10 right-[24%] hidden rotate-12 sm:block" aria-hidden="true">
			<svg width="40" height="46" viewBox="0 0 40 46">
				<path d="M4 24 h32 v4 a16 16 0 0 1 -32 0 z" fill="#fffefd" />
				<path d="M4 24 a16 16 0 0 1 32 0 z" fill="#e8a94f" />
			</svg>
		</div>
		<div class="absolute top-14 right-[3%] hidden rotate-6 opacity-60 sm:block" aria-hidden="true">
			<svg width="32" height="37" viewBox="0 0 40 46">
				<path d="M4 24 h32 v4 a16 16 0 0 1 -32 0 z" fill="#fffefd" />
				<path d="M4 24 a16 16 0 0 1 32 0 z" fill="#8a92e3" />
			</svg>
		</div>

		<p class="text-heading font-bold text-white">カプセルトイの新作を、メーカー横断でチェック</p>
		<div class="flex flex-wrap gap-2 pt-2.5" aria-label="掲載の規模">
			<span class="rounded-full bg-white/20 px-3 py-1 text-note font-bold text-white">
				今月の新作 {data.counts.thisMonth}件
			</span>
			<span class="rounded-full bg-white/20 px-3 py-1 text-note font-bold text-white">
				{data.makers.length}社 {data.counts.total.toLocaleString()}件を掲載
			</span>
		</div>
		<div class="flex max-w-xl items-center gap-2.5 pt-4">
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
					class="w-full rounded-full bg-surface px-5 py-2.5 text-body shadow-clay-sm outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
				/>
			</form>
			<button
				type="button"
				onclick={() => (filtersOpen = !filtersOpen)}
				aria-expanded={filtersOpen}
				aria-label="絞り込み"
				class={[
					'pressable relative grid h-10 w-10 flex-none place-items-center rounded-full',
					filtersOpen ? 'bg-ink text-white shadow-clay-pressed' : 'bg-surface shadow-clay-sm'
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
					<span class="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-ink" aria-hidden="true"
					></span>
				{/if}
			</button>
		</div>
	</div>
</div>

<main class="mx-auto max-w-2xl px-4 pb-16 lg:max-w-5xl">
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
					<p class="text-body font-extrabold">絞り込み</p>
					<button
						type="button"
						aria-label="閉じる"
						onclick={() => (filtersOpen = false)}
						class="pressable grid h-8 w-8 place-items-center rounded-full bg-ground text-faint shadow-clay-sm"
					>
						✕
					</button>
				</div>
				{#each [['発売月', monthChips], ['メーカー', makerChips], ['価格', priceChips], ['並び順', sortChips]] as const as [label, chips] (label)}
					<div>
						<p class="pb-2 text-note font-bold text-faint">{label}</p>
						<div class="flex flex-wrap gap-2">
							{#each chips as chip (chip.label)}
								<a
									href={chip.href}
									class={[
										'pressable rounded-full px-3.5 py-1.5 text-note font-bold whitespace-nowrap',
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
					class="pressable rounded-full bg-surface px-3.5 py-1.5 text-note font-bold text-accent shadow-clay-sm"
				>
					{chip.label} ✕
				</a>
			{/each}
		</div>
	{/if}

	{#if data.filters.keyword}
		<p class="pt-3 text-body text-faint">
			「{data.filters.keyword}」の検索結果 {data.total}件{data.hasMore ? '以上' : ''}
			<!-- link() は resolve() 起点でクエリを組むが、静的解析では追えない -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={link('q', null)} class="ml-2 font-bold text-accent">解除</a>
		</p>
	{/if}

	<div class="pt-5">
		{#if data.groups.length === 0}
			<div class="flex flex-col gap-2 py-16 text-center text-body text-faint">
				<p>この条件の商品はありません</p>
				{#if isFutureMonth}
					<!-- 句点で折り返す。文の途中では改行しない -->
					<p class="text-note">
						<span class="inline-block">メーカーの発表は発売の1〜2ヶ月前です。</span>
						<span class="inline-block">発表までしばらくお待ちください。</span>
					</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-6">
				{#each data.groups as group (group.yearMonth ?? 'unknown')}
					<MonthGroup {group} />
				{/each}
			</div>
			{#if data.hasMore}
				<p class="pt-6 text-center text-note text-faint">
					表示は{data.total}件まで。絞り込みか検索で狭められます
				</p>
			{/if}
		{/if}
	</div>
</main>
