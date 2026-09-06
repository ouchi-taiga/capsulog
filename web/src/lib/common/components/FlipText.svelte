<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';

	let { value }: { value: string } = $props();

	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	/* 送っている間だけ、前の値を下に残して2行にする */
	let previous = $state<string | null>(null);
	let shown = $state<string | null>(null);
	let sliding = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const next = value;
		// 初回は送らない。開いた時点の値をそのまま置く
		if (shown === null) {
			shown = next;
			return;
		}
		if (next === shown) return;
		if (reduceMotion.current) {
			shown = next;
			return;
		}
		// 新しい値を上に積み、上へずらした位置から戻す。パタパタ時計と同じ向き
		previous = shown;
		shown = next;
		sliding = false;
		requestAnimationFrame(() => (sliding = true));
		clearTimeout(timer);
		// --duration-open と揃える。短いと跳ね返りの途中で前の行が消える
		timer = setTimeout(() => {
			previous = null;
			sliding = false;
		}, 320);
	});
</script>

<span class="flip">
	<span class="inner" class:sliding class:stacked={previous !== null}>
		<span>{shown ?? value}</span>
		{#if previous !== null}<span>{previous}</span>{/if}
	</span>
</span>

<style>
	/* 送っている間は2行になり、長いほうに幅が広がる。
	   親の幅いっぱいを取って、終わったあとに文字が動かないようにする */
	.flip {
		display: block;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		height: 1.4em;
		text-align: left;
	}
	.inner {
		display: block;
	}
	.inner > span {
		display: block;
		height: 1.4em;
		line-height: 1.4em;
	}
	/* 2行になった瞬間は上にずらしておき、そこから 0 へ戻して降ろす */
	.stacked {
		transform: translateY(-1.4em);
	}
	/* none ではなく 0 を書く。none だと跳ね返りが 0 で打ち切られる */
	.sliding {
		transform: translateY(0);
		transition: transform var(--duration-open) var(--ease-bounce);
	}
	@media (prefers-reduced-motion: reduce) {
		.sliding {
			transition: none;
		}
	}
</style>
