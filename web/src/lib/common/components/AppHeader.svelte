<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let scrollY = $state(0);
	let heroHeight = $state(0);

	// 各ページの色エリア（data-hero）の高さを測る。遷移のたびに測り直す
	$effect(() => {
		void page.url.pathname;
		heroHeight = document.querySelector('[data-hero]')?.clientHeight ?? 0;
	});

	// 色エリアの下端がヘッダーの裏を抜けて、背景がクリームに変わるところで白い帯にする
	let floating = $derived(scrollY > Math.max(heroHeight - 80, 16));
</script>

<svelte:window bind:scrollY />

<header
	class={[
		'fixed inset-x-0 top-0 z-10 px-4 py-4 transition-colors duration-300',
		floating ? 'floating text-accent' : 'text-white'
	]}
>
	<div class="mx-auto max-w-2xl lg:max-w-5xl">
		<a href={resolve('/')} class="text-site font-extrabold">
			カプセ<span class="text-ink">ログ</span>
		</a>
	</div>
</header>

<style>
	/* 白帯の背景。下に向かって色もぼかしも透けていく。
	   opacity の遷移で出し入れし、文字の色遷移と同期させる */
	header::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		opacity: 0;
		transition: opacity 300ms;
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		backdrop-filter: blur(10px);
		mask-image: linear-gradient(to bottom, black 55%, transparent);
	}
	header.floating::before {
		opacity: 1;
	}
</style>
