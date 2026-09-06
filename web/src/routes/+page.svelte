<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Popover from '$lib/common/components/ui/popover';
	import * as Select from '$lib/common/components/ui/select';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { formatYearMonth, shiftYearMonth } from '$lib/calendar/format';
	import FlipText from '$lib/common/components/FlipText.svelte';
	import FlipNumber from '$lib/common/components/FlipNumber.svelte';
	import EmptyState from '$lib/calendar/components/EmptyState.svelte';
	import MonthGroup from '$lib/calendar/components/MonthGroup.svelte';
	import MonthHeading from '$lib/calendar/components/MonthHeading.svelte';
	import BrowseRow from '$lib/calendar/components/BrowseRow.svelte';
	import type { MonthGroup as MonthGroupData } from '$lib/calendar/types';

	let { data } = $props();

	// シートの開閉。同一ルート内の遷移ではコンポーネントが生きるので、条件を選んでも閉じない
	let filtersOpen = $state(false);
	/** 現在の URL から1つのパラメータだけ差し替えたリンクを作る */
	function link(key: string, value: string | null): string {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (value === null) params.delete(key);
		else params.set(key, value);
		// 条件が変われば読み進めた分は無効になる。1ページ目から見せ直す
		if (key !== 'offset') params.delete('offset');
		const query = params.toString();
		return query ? `?${query}` : resolve('/');
	}

	// 選んでいる年。'YYYY' でなければ null
	let selectedYear = $derived(/^\d{4}$/.test(data.filters.month ?? '') ? data.filters.month : null);
	// 1つの月を選んでいるか。年の一覧はどの月にも通じているので、月の新旧では分けない
	let selectedMonth = $derived(
		/^\d{4}-\d{2}$/.test(data.filters.month ?? '') ? data.filters.month : null
	);
	// 年を選んでいる間も、過去を辿っている状態には変わりない。
	// 先々月以前の月は年の一覧から来ているので、過去への入口を重ねて出さない
	let viewingPast = $derived(
		data.filters.month === 'earlier' ||
			selectedYear !== null ||
			(selectedMonth !== null && selectedMonth < data.previousYearMonth)
	);

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
		data.years.map((entry) => ({
			...entry,
			href: link('month', entry.year),
			months: entry.months.map((month) => ({ ...month, href: link('month', month.yearMonth) }))
		}))
	);

	/* 開いている年。1つだけ開く。並べたままだと 17 年分の月が縦に続く */
	let openYear = $state<string | null>(null);
	/* 開く先の高さ。折り返しは画面幅で変わるため、中身を測って持つ */
	let heights = $state<Record<string, number>>({});

	/*
	 * 並び替えが開いている間、一覧の操作を止める。
	 * スマホでは選択肢の下に商品が重なり、閉じる瞬間に指がそちらへ届いてしまう
	 */
	let sortOpen = $state(false);

	let loading = $state(false);
	let moreButton = $state<HTMLButtonElement | null>(null);

	/*
	 * 画面に出している一覧。load の結果をそのまま描かず、ここに貯める。
	 * 一覧ごと取り直すと、既にある商品まで作り直されて画面が一度消えてしまう。
	 */
	// 初期値は load の結果。空から始めると、一瞬「商品がありません」が出る
	let groups = $state<MonthGroupData[]>(untrack(() => data.groups));
	let nextOffset = $state(untrack(() => data.nextOffset));
	let hasMore = $state(untrack(() => data.hasMore));

	/* 月の箱を保ったまま後ろに繋ぐ。境目が同じ月なら1つにまとめる */
	function append(base: MonthGroupData[], incoming: MonthGroupData[]): MonthGroupData[] {
		const merged = base.map((group) => ({ ...group, items: [...group.items] }));
		for (const group of incoming) {
			const last = merged.at(-1);
			if (last && last.yearMonth === group.yearMonth && last.heading === group.heading) {
				last.items.push(...group.items);
			} else {
				merged.push({ ...group, items: [...group.items] });
			}
		}
		return merged;
	}

	/*
	 * load がやり直されるたびに走る。
	 * offset があれば続きなので後ろへ足し、無ければ条件が変わったので置き換える。
	 */
	$effect(() => {
		const incoming = data.groups;
		const isMore = data.offset > 0;
		// groups を読むと依存に入って更新が止まる。前の値は untrack して取る
		groups = isMore
			? append(
					untrack(() => groups),
					incoming
				)
			: incoming;
		nextOffset = data.nextOffset;
		hasMore = data.hasMore;
	});

	/** 続きを読む。今ある一覧はそのままに、次の分だけ取りに行く */
	async function loadMore() {
		if (loading || !hasMore) return;
		loading = true;
		// 履歴を汚さず、今の位置も保つ
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(link('offset', String(nextOffset)), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
		loading = false;
		// offset は読み進めるための一時の値。共有された URL では 1 ページ目から見せる
		history.replaceState(history.state, '', link('offset', null));
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

	/**
	 * 選択中の条件。既定値のままのものは出さない。
	 * 1つの月を見ている間は月を出さない。見出しと前後の送りが現在地を示している
	 */
	let applied = $derived(
		[
			data.filters.month &&
				!selectedMonth && {
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

	/*
	 * 前後の月への移動。1つの月を見ているときだけ出す。
	 * 「今月・来月」のような範囲では、どちらへ動かすかが決められない。
	 */
	let monthSteps = $derived.by(() => {
		// 既定は今月を見ている状態。month が無くても送りは出す
		const month = data.filters.month ?? (data.filters.keyword ? null : data.thisYearMonth);
		if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
		const step = (offset: number) => {
			const target = shiftYearMonth(month, offset);
			return { month: String(Number(target.slice(5))), href: link('month', target) };
		};
		return {
			previous: step(-1),
			next: step(1),
			// 今月を見ているときは出さない。行き先が今と同じになる
			home: month === data.thisYearMonth ? null : link('month', data.thisYearMonth)
		};
	});

	/*
	 * 過去への入口。既定では今月と来月しか出ないので、それ以前があることが分からない。
	 * 過去を見ている間と、検索や絞り込みの結果を見ている間は出さない。条件から外れて見えるため。
	 */
	let pastEntry = $derived(
		!viewingPast && applied.length === 0 && !data.filters.keyword && data.counts.past > 0
			? {
					href: link('month', 'earlier'),
					count: data.counts.past,
					oldestYear: data.counts.oldestYear
				}
			: null
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
				今月の新作 <FlipNumber value={data.counts.thisMonth} />件
			</span>
			<span class="rounded-full bg-white/20 px-3 py-1 text-note font-bold text-white">
				{data.makers.length}社 <FlipNumber value={data.counts.total} />件を掲載
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
			<!-- 絞り込みは並び替えと同じ扱いにする。押した場所から開き、外を触れば閉じる -->
			<Popover.Root bind:open={filtersOpen}>
				<Popover.Trigger
					aria-label="絞り込み"
					class={[
						'pressable relative grid h-10 w-10 flex-none place-items-center rounded-full',
						filtersOpen
							? 'bg-ink text-white shadow-clay-pressed'
							: 'bg-surface shadow-clay-on-color'
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
						<span
							class="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-ink"
							aria-hidden="true"
						></span>
					{/if}
				</Popover.Trigger>
				<Popover.Content>
					<p class="text-heading font-extrabold">絞り込み</p>
					{#each [['メーカー', makerChips], ['価格', priceChips]] as const as [label, chips] (label)}
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
				</Popover.Content>
			</Popover.Root>
		</div>
	</div>
</div>

<main class="mx-auto max-w-2xl px-4 pb-16 lg:max-w-5xl">
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

	<!-- 商品が無い月でも並びは変えられる。出し入れすると月を送るたびにちらつく -->
	<div class="flex items-center justify-between gap-2 pt-3">
		{#if pastEntry}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={pastEntry.href} class="text-note font-bold text-faint hover:text-accent">
				過去の商品を探す ({pastEntry.count.toLocaleString('ja-JP')}件) →
			</a>
		{:else if selectedYear || selectedMonth || data.filters.month === 'unknown'}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={link('month', 'earlier')} class="text-note font-bold text-accent"> ← 年の一覧へ </a>
		{:else}
			<span></span>
		{/if}
		<Select.Root
			type="single"
			value={data.activeSort}
			onValueChange={selectSort}
			bind:open={sortOpen}
		>
			<!-- 選ぶ語で幅が動かないよう、開いたときのパネルと同じ幅に固定する -->
			<Select.Trigger aria-label="並び替え" class="w-40">
				<FlipText value={SORT_LABELS[data.activeSort]} />
			</Select.Trigger>
			<Select.Content align="end" sideOffset={8}>
				{#each Object.entries(SORT_LABELS) as [value, label] (value)}
					<Select.Item {value} {label} />
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- 並び替えを開いている間は触れないようにする。閉じる指が下の商品に届くのを防ぐ -->
	<div class="pt-5" inert={sortOpen}>
		{#if data.years.length > 0}
			<!-- 過去は 185 ヶ月ある。年を開いて、その年すべてか月かを選ばせる -->
			<ul class="flex flex-col gap-3">
				{#each yearLinks as { year, count, href, months } (year)}
					{@const open = openYear === year}
					<!-- 年のカードそのものが下に伸びる。中身は同じ面に収める -->
					<li class="overflow-hidden rounded-3xl bg-surface shadow-clay">
						<button
							type="button"
							onclick={() => (openYear = open ? null : year)}
							aria-expanded={open}
							class="pressable-flat w-full"
						>
							<BrowseRow title={year} unit="年" {count}>
								{#snippet trailing()}
									<span
										class={[
											'text-note font-bold text-faint transition-transform',
											open && 'rotate-180'
										]}
										aria-hidden="true"
									>
										▾
									</span>
								{/snippet}
							</BrowseRow>
						</button>
						<!-- 中身の実寸へ向けて開く。折り返しは画面幅で変わるので、その都度測る -->
						<div class={['fold', open && 'fold-open']} style="--height: {heights[year] ?? 0}px">
							<div bind:offsetHeight={heights[year]}>
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<!-- 桁数で幅が変わると右端が揃わない。等分の格子に並べる -->
								<ul class="grid grid-cols-3 gap-2 px-5 pt-1 pb-5 sm:grid-cols-5 lg:grid-cols-7">
									<li class="fold-item">
										<a
											{href}
											class="pressable flex items-baseline justify-center gap-1 rounded-2xl bg-ground px-2 py-2.5 shadow-clay-sm"
										>
											<span class="text-heading font-extrabold">すべて</span>
											<span class="pl-0.5 text-note font-bold text-faint tabular-nums">
												{count}件
											</span>
										</a>
									</li>
									{#each months as month, index (month.yearMonth)}
										<li class="fold-item" style="--order: {index + 1}">
											<a
												href={month.href}
												class="pressable flex items-baseline justify-center gap-1 rounded-2xl bg-ground px-2 py-2.5 shadow-clay-sm"
											>
												<span class="text-heading font-extrabold tabular-nums">
													{Number(month.yearMonth.slice(5))}
												</span>
												<span class="text-body font-bold">月</span>
												<span class="pl-0.5 text-note font-bold text-faint tabular-nums">
													{month.count}件
												</span>
											</a>
										</li>
									{/each}
								</ul>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</div>
						</div>
					</li>
				{/each}
				{#if data.counts.unknown > 0}
					<!-- 月を持たないものは年からは辿れない。年の並びの終わりに置く -->
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={link('month', 'unknown')}
							class="pressable block rounded-3xl bg-surface shadow-clay"
						>
							<BrowseRow title="発売月不明" count={data.counts.unknown} />
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/if}
			</ul>
		{:else if groups.length === 0}
			{#if monthSteps}
				<!-- 商品が無くても月は送れる。ここで行き止まりにしない。
				     余白は一覧の見出しと揃える。月を送るたびに位置が動いて見える -->
				<div class="pt-2">
					<MonthHeading yearMonth={data.filters.month} count={0} steps={monthSteps} />
				</div>
			{/if}
			<EmptyState title={empty.title} hint={empty.hint} action={empty.action} />
		{:else}
			<div class="flex flex-col gap-6">
				<!-- 価格順は月を持たない。見出しで見分ける -->
				{#each groups as group, index (group.heading ?? group.yearMonth ?? 'unknown')}
					<!-- 今月へ戻る道は先頭の見出しにだけ添える。何度も出す意味はない -->
					<MonthGroup {group} steps={index === 0 ? monthSteps : null} />
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
			{#if pastEntry && !data.hasMore}
				<!-- 読み終えた先に置く。ここまで来た人は、次に見るものを探している -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={pastEntry.href}
					class="pressable mt-8 flex items-center justify-between gap-3 rounded-3xl bg-surface px-5 py-4 shadow-clay"
				>
					<span>
						<span class="text-body font-extrabold">過去の商品を探す</span>
						<span class="block pt-0.5 text-note font-bold text-faint">
							{pastEntry.oldestYear
								? `${pastEntry.oldestYear}年からの${pastEntry.count.toLocaleString('ja-JP')}件`
								: `${pastEntry.count.toLocaleString('ja-JP')}件`}
						</span>
					</span>
					<span class="text-title font-extrabold text-accent">→</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{/if}
	</div>
</main>
