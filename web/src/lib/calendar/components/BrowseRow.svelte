<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		unit,
		count,
		trailing
	}: {
		/** 左端に大きく出す語。年の数字や「発売月不明」 */
		title: string;
		/** title に添える単位。「年」など。無い語もある */
		unit?: string;
		count: number;
		/** 右端に添えるもの。開閉の印など */
		trailing?: Snippet;
	} = $props();
</script>

<!--
	辿るための行。年も発売月不明もこの形で並ぶ。
	高さは title の行で決まるので、語の大きさが違っても揃う。
-->
<span class="flex w-full items-baseline gap-2.5 px-5 py-4 text-left">
	<span class="text-site leading-9 font-extrabold tabular-nums">{title}</span>
	{#if unit}<span class="text-body font-bold">{unit}</span>{/if}
	<span class="ml-auto text-note font-bold text-faint tabular-nums">{count}件</span>
	{@render trailing?.()}
</span>
