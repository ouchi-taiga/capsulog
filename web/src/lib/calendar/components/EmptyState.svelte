<script lang="ts">
	let {
		title,
		hint,
		action
	}: {
		title: string;
		/** 状況の補足。なぜ空なのかを言う */
		hint?: string;
		/** 次にできること。押すと条件が外れる */
		action?: { label: string; href: string };
	} = $props();

	const ACTION_CLASS =
		'pressable rounded-full bg-surface px-5 py-2.5 text-note font-bold text-accent shadow-clay-sm';
</script>

<div class="flex flex-col items-center gap-4 py-14 text-center">
	<!-- 開いた空のカプセル。中身が無いことを、題材の形で見せる -->
	<svg width="64" height="74" viewBox="0 0 40 46" class="capsule" aria-hidden="true">
		<path d="M4 24 h32 v4 a16 16 0 0 1 -32 0 z" fill="var(--surface)" />
		<path
			d="M4 24 a16 16 0 0 1 32 0 z"
			fill="none"
			stroke="var(--faint)"
			stroke-width="1.4"
			stroke-dasharray="3 3.5"
			opacity="0.55"
		/>
		<rect x="4" y="23" width="32" height="2" fill="var(--faint)" opacity="0.14" />
	</svg>

	<div class="flex flex-col gap-1.5">
		<p class="text-body font-bold text-ink">{title}</p>
		{#if hint}
			<!-- 句点で折り返す。文の途中では改行しない -->
			<p class="text-note text-faint">
				{#each hint.split('。').filter(Boolean) as sentence (sentence)}
					<span class="inline-block">{sentence}。</span>
				{/each}
			</p>
		{/if}
	</div>

	{#if action}
		<!-- 呼び出し元が resolve() 起点で組んだクエリ。静的解析では追えない -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={action.href} class={ACTION_CLASS}>{action.label}</a>
	{/if}
</div>

<style>
	/* 地色に溶けないよう、うっすら影を落とす */
	.capsule {
		filter: drop-shadow(3px 4px 6px var(--sh));
	}
</style>
