<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Dialog from '$lib/common/components/ui/dialog';
	import * as Select from '$lib/common/components/ui/select';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { formatYearMonth } from '$lib/calendar/format';
	import FlipText from '$lib/common/components/FlipText.svelte';
	import EmptyState from '$lib/calendar/components/EmptyState.svelte';
	import MonthGroup from '$lib/calendar/components/MonthGroup.svelte';

	let { data } = $props();

	// シートの開閉。同一ルート内の遷移ではコンポーネントが生きるので、条件を選んでも閉じない
	let filtersOpen = $state(false);
	/** 現在の URL から1つのパラメータだけ差し替えたリンクを作る */
	function link(key: string, value: string | null): string {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (value === null) params.delete(key);
		else params.set(key, value);
		// 条件が変われば読み進めた分は無効になる。1ページ目から見せ直す
		if (key !== 'limit') params.delete('limit');
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

	// 選んでいる年。'YYYY' でなければ null
	let selectedYear = $derived(/^\d{4}$/.test(data.filters.month ?? '') ? data.filters.month : null);
	// 年を選んでいる間も、過去を辿っている状態には変わりない
	let viewingPast = $derived(data.filters.month === 'earlier' || selectedYear !== null);

	// 時系列順に並べ、既定の「今月・来月」を先月と今月の間に挟む
	let monthChips = $derived([
		{
			label: `先々月以前 (〜${formatYearMonth(data.earlierYearMonth).slice(5)})`,
			href: link('month', 'earlier'),
			on: viewingPast
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

	const SORT_LABELS = {
		'release-desc': '発売が新しい順',
		'release-asc': '発売が古い順',
		'price-asc': '価格が安い順',
		'price-desc': '価格が高い順'
	} as const;

	let yearLinks = $derived(
		data.years.map((entry) => ({ ...entry, href: link('month', entry.year) }))
	);

	/*
	 * 並び替えが開いている間、一覧の操作を止める。
	 * スマホでは選択肢の下に商品が重なり、閉じる瞬間に指がそちらへ届いてしまう
	 */
	let sortOpen = $state(false);

	let loading = $state(false);
	let moreButton = $state<HTMLButtonElement | null>(null);

	/** 続きを読む。limit を増やして load をやり直させる */
	async function loadMore() {
		if (loading || !data.hasMore) return;
		loading = true;
		// 積んだ分を消さずに増やすため、履歴を汚さず今の位置も保つ
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(link('limit', String(data.nextLimit)), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
		loading = false;
	}

	// 下端が見えたら自動で読む。ボタンは JS が動かないときと、自動が届かないときの受け皿
	$effect(() => {
		const target = moreButton;
		if (!target) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) loadMore();
			},
			// 下端に着く手前から読み始める。待ち時間を感じさせない
			{ rootMargin: '600px' }
		);
		observer.observe(target);
		return () => observer.disconnect();
	});

	/** 並び替えを選んだら、その条件で開き直す */
	function selectSort(value: string) {
		// link() は resolve() 起点でクエリを組むが、静的解析では追えない
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		if (value !== data.activeSort) goto(link('sort', value));
	}

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
					] ??
					(/^\d{4}$/.test(data.filters.month)
						? `${data.filters.month}年`
						: formatYearMonth(data.filters.month)),
				href: link('month', null)
			},
			data.filters.makerCode && {
				label: data.makers.find((maker) => maker.code === data.filters.makerCode)?.name ?? '',
				href: link('maker', null)
			},
			data.filters.priceBand && {
				label: { '300': '〜300円', '400': '400円台', '500': '500円〜' }[data.filters.priceBand],
				href: link('price', null)
			}
		].filter((chip) => !!chip)
	);

	/* 空になった理由ごとに、言うことと次にできることを変える */
	let empty = $derived.by(() => {
		if (isFutureMonth) {
			return {
				title: 'まだ発表されていません',
				hint: 'メーカーの発表は発売の1〜2ヶ月前です。発表されるとここに並びます。',
				action: { label: '今月・来月を見る', href: link('month', null) }
			};
		}
		if (data.filters.keyword) {
			return {
				title: `「${data.filters.keyword}」は見つかりませんでした`,
				hint: '商品名の一部で探せます。ひらがなとカタカナは区別されます。',
				action: { label: '検索をやめる', href: link('q', null) }
			};
		}
		// 検索なしで空になるのは、絞り込みを重ねたとき
		return {
			title: 'この条件の商品はありません',
			hint: '条件を減らすと見つかることがあります。',
			action: applied.length > 0 ? { label: '条件をすべて外す', href: resolve('/') } : undefined
		};
	});
</script>

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
					class="w-full rounded-full bg-surface px-5 py-2 text-input shadow-clay-on-color outline-none placeholder:text-faint focus:ring-2 focus:ring-white"
				/>
			</form>
			<button
				type="button"
				onclick={() => (filtersOpen = !filtersOpen)}
				aria-expanded={filtersOpen}
				aria-label="絞り込み"
				class={[
					'pressable relative grid h-10 w-10 flex-none place-items-center rounded-full',
					filtersOpen ? 'bg-ink text-white shadow-clay-pressed' : 'bg-surface shadow-clay-on-color'
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
	<Dialog.Root bind:open={filtersOpen}>
		<Dialog.Content>
			<Dialog.Title>絞り込み</Dialog.Title>
			{#each [['発売月', monthChips], ['メーカー', makerChips], ['価格', priceChips]] as const as [label, chips] (label)}
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
		</Dialog.Content>
	</Dialog.Root>

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

	{#if selectedYear}
		<p class="pt-3">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={link('month', 'earlier')} class="text-body font-bold text-accent">← 年の一覧へ</a>
		</p>
	{/if}

	{#if data.filters.keyword}
		<p class="pt-3 text-body text-faint">
			「{data.filters.keyword}」の検索結果 {data.total}件{data.hasMore ? '以上' : ''}
			<!-- link() は resolve() 起点でクエリを組むが、静的解析では追えない -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={link('q', null)} class="ml-2 font-bold text-accent">解除</a>
		</p>
	{/if}

	{#if data.groups.length > 0}
		<div class="flex items-center justify-end gap-2 pt-3">
			<span class="text-note font-bold text-faint" id="sort-label">並び替え</span>
			<Select.Root
				type="single"
				value={data.activeSort}
				onValueChange={selectSort}
				bind:open={sortOpen}
			>
				<!-- 選ぶ語で幅が動かないよう、開いたときのパネルと同じ幅に固定する -->
				<Select.Trigger aria-labelledby="sort-label" class="w-40">
					<FlipText value={SORT_LABELS[data.activeSort]} />
				</Select.Trigger>
				<Select.Content align="end" sideOffset={8}>
					{#each Object.entries(SORT_LABELS) as [value, label] (value)}
						<Select.Item {value} {label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	{/if}

	<!-- 並び替えを開いている間は触れないようにする。閉じる指が下の商品に届くのを防ぐ -->
	<div class="pt-5" inert={sortOpen}>
		{#if data.years.length > 0}
			<!-- 過去は 185 ヶ月ある。年を選ばせてから月を見せる -->
			<ul class="flex flex-col gap-3">
				{#each yearLinks as { year, count, href } (year)}
					<li>
						<a
							{href}
							class="pressable flex items-baseline gap-2.5 rounded-3xl bg-surface px-5 py-4 shadow-clay"
						>
							<span class="text-site font-extrabold tabular-nums">{year}</span>
							<span class="text-body font-bold">年</span>
							<span class="ml-auto text-note font-bold text-faint tabular-nums">{count}件</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else if data.groups.length === 0}
			<EmptyState title={empty.title} hint={empty.hint} action={empty.action} />
		{:else}
			<div class="flex flex-col gap-6">
				{#each data.groups as group (group.yearMonth ?? 'unknown')}
					<MonthGroup {group} />
				{/each}
			</div>
			{#if data.hasMore}
				<!-- 下端が見えたら自動で読む。JS が動かないときのためにボタンも押せる形にする -->
				<div class="flex justify-center pt-6">
					<button
						type="button"
						bind:this={moreButton}
						onclick={loadMore}
						disabled={loading}
						class="pressable rounded-full bg-surface px-6 py-2.5 text-body font-bold text-accent shadow-clay-sm disabled:opacity-60"
					>
						{loading ? '読み込み中…' : 'さらに表示'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</main>
