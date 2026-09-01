<script lang="ts">
	import { capsuleColorAt } from '../capsule';

	let {
		count,
		hasSecret = false,
		seed
	}: {
		/** 並べるカプセルの数。全何種 */
		count: number;
		/** true なら最後の1個を「?」にする */
		hasSecret?: boolean;
		/** 配色と傾きの種。商品 id を渡すと商品ごとに固定の見た目になる */
		seed: number;
	} = $props();

	function colorAt(index: number): string {
		return capsuleColorAt(seed, index);
	}

	function tiltAt(index: number): number {
		return ((seed * 7 + index * 5) % 13) - 6;
	}
</script>

<div
	role="img"
	aria-label="カプセル 全{count}種"
	class="flex flex-wrap items-end justify-center gap-2.5 rounded-3xl px-4 py-6"
>
	{#each { length: count }, index (index)}
		{@const secret = hasSecret && index === count - 1}
		<svg
			width="40"
			height="46"
			viewBox="0 0 40 46"
			style="transform: rotate({tiltAt(index)}deg)"
			class="capsule"
			aria-hidden="true"
		>
			<!-- 下半分の透明カップ -->
			<path d="M4 24 h32 v4 a16 16 0 0 1 -32 0 z" fill={secret ? '#6b6276' : '#ffffff'} />
			<!-- 上半分のドーム -->
			<path d="M4 24 a16 16 0 0 1 32 0 z" fill={secret ? '#4a3d51' : colorAt(index)} />
			<!-- 合わせ目 -->
			<rect x="4" y="23" width="32" height="2" fill="#000000" opacity="0.08" />
			<!-- ハイライト -->
			<ellipse
				cx="13"
				cy="14"
				rx="4.5"
				ry="6.5"
				fill="#ffffff"
				opacity="0.4"
				transform="rotate(-25 13 14)"
			/>
			{#if secret}
				<text x="20" y="33" text-anchor="middle" font-size="22" font-weight="800" fill="#ffffff">
					?
				</text>
			{/if}
		</svg>
	{/each}
</div>

<style>
	.capsule {
		filter: drop-shadow(3px 4px 4px var(--sh));
	}
</style>
