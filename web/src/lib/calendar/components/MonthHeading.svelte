<script lang="ts">
	import { currentYearMonth } from '../format';

	let {
		yearMonth,
		count
	}: {
		/** 'YYYY-MM'。null は発売月不明 */
		yearMonth: string | null;
		count: number;
	} = $props();

	let year = $derived(yearMonth?.split('-')[0] ?? null);
	let month = $derived(yearMonth ? Number(yearMonth.split('-')[1]) : null);

	// 今月と来月だけ言い添える。節目がどこかを一目で分かるようにする
	let label = $derived(
		yearMonth === currentYearMonth(0) ? '今月' : yearMonth === currentYearMonth(1) ? '来月' : null
	);
</script>

<h2 class="flex items-center gap-2.5 px-1 pb-3">
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
</h2>
