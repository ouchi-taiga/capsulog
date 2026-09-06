<script lang="ts">
	import { currentYearMonth } from '../format';

	type Step = { month: string; href: string };

	let {
		yearMonth,
		count,
		steps = null
	}: {
		/** 'YYYY-MM'。null は発売月不明 */
		yearMonth: string | null;
		count: number;
		/** 月をめくる道。1つの月を見ているときだけ渡す */
		steps?: { previous: Step; next: Step; home: string | null } | null;
	} = $props();

	let year = $derived(yearMonth?.split('-')[0] ?? null);
	let month = $derived(yearMonth ? Number(yearMonth.split('-')[1]) : null);

	// 今月と来月だけ言い添える。節目がどこかを一目で分かるようにする
	let label = $derived(
		yearMonth === currentYearMonth(0) ? '今月' : yearMonth === currentYearMonth(1) ? '来月' : null
	);
</script>

<!-- 文字は下の線で揃える。箱の中央で揃えると、大きさの違う語が上下にずれて見える -->
<h2 class="flex flex-wrap items-baseline gap-x-2.5 gap-y-2 px-1 pb-3">
	{#if month === null}
		<span class="text-title font-extrabold text-faint">発売月不明</span>
	{:else}
		<span class="flex items-baseline gap-1 font-extrabold">
			<span class="text-note text-faint">{year}</span>
			<!-- 月を大きく出す。並んだときに節目として目に留まる -->
			<span class="text-site leading-none text-ink tabular-nums">{month}</span>
			<span class="text-body text-ink">月</span>
		</span>
		{#if label}
			<span
				class="rounded-full bg-accent px-2.5 py-1 text-note leading-none font-bold text-on-accent"
			>
				{label}
			</span>
		{/if}
	{/if}
	<span class="text-note text-faint">{count}件</span>
	{#if steps}
		<!-- 現在地に対する操作なので、見出しと同じ行に置く -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<!--
			幅を決めて並べる。月の桁数や「今月」の有無で位置が動くと、
			続けて押すたびに指の下からボタンが逃げる
		-->
		<span class="ml-auto grid w-45 flex-none grid-cols-3 gap-1.5">
			<a
				href={steps.previous.href}
				class="pressable rounded-full bg-surface py-1.5 text-center text-note font-bold shadow-clay-sm"
			>
				← {steps.previous.month}月
			</a>
			{#if steps.home}
				<a
					href={steps.home}
					class="pressable rounded-full bg-surface py-1.5 text-center text-note font-bold text-accent shadow-clay-sm"
				>
					今月
				</a>
			{:else}
				<span></span>
			{/if}
			<a
				href={steps.next.href}
				class="pressable rounded-full bg-surface py-1.5 text-center text-note font-bold shadow-clay-sm"
			>
				{steps.next.month}月 →
			</a>
		</span>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
</h2>
