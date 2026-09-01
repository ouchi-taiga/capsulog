<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		backHref,
		backLabel = '',
		sticky = false,
		children
	}: {
		/** 指定すると左が戻るリンクになり、ロゴが右へ寄る */
		backHref?: string;
		backLabel?: string;
		sticky?: boolean;
		/** ロゴの反対側に置くもの。検索フォームなど */
		children?: Snippet;
	} = $props();
</script>

<header
	class={['deco-dots px-4 pt-5 pb-3', sticky && 'sticky top-0 z-10 bg-ground/95 backdrop-blur-sm']}
>
	<div class="mx-auto flex max-w-2xl items-center justify-between lg:max-w-5xl">
		{#if backHref}
			<!-- backHref は呼び出し側が resolve() で作る -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={backHref} class="text-sm font-extrabold">← {backLabel}</a>
			<span class="text-lg font-extrabold">カプセ<span class="text-accent">ログ</span></span>
		{:else}
			<h1 class="text-xl font-extrabold">カプセ<span class="text-accent">ログ</span></h1>
			{@render children?.()}
		{/if}
	</div>
</header>
