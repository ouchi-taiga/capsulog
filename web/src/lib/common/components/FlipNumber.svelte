<script lang="ts">
	let { value }: { value: number } = $props();

	/* 3桁ごとの区切りは桁として送らず、文字のまま置く */
	let parts = $derived(value.toLocaleString('ja-JP').split(''));

	/**
	 * その桁に積む数字。目的の数字を一番上に置き、その下に 0 までを降順で並べる。
	 *
	 * 0 が見えている位置から始めて 0 へ戻すと、目的の数字が上から降りてくる。
	 */
	function stackOf(part: string): number[] {
		const target = Number(part);
		return Array.from({ length: target + 1 }, (_, index) => target - index);
	}
</script>

<span class="tabular-nums">
	{#each parts as part, index (index)}
		{#if part === ','}
			<span>{part}</span>
		{:else}
			<span class="digit">
				<!-- 0 が窓に来た位置から始まり、目的の数字まで降りてくる -->
				<span class="inner rolling" style="--to: {part}; --order: {index}">
					{#each stackOf(part) as digit (digit)}
						<span>{digit}</span>
					{/each}
				</span>
			</span>
		{/if}
	{/each}
</span>

<style>
	.digit {
		display: inline-block;
		overflow: hidden;
		height: 1.4em;
		width: 0.58em;
		vertical-align: bottom;
		line-height: 1.4em;
	}
	.inner {
		display: block;
	}
	.inner > span {
		display: block;
		height: 1.4em;
		line-height: 1.4em;
		text-align: center;
	}
	/* 左の桁から順に送る。0 が見えている位置から 0 へ戻して降ろす */
	.rolling {
		animation: roll-down 0.9s var(--ease-bounce) backwards;
		animation-delay: calc(var(--order) * 60ms);
	}
	@keyframes roll-down {
		from {
			transform: translateY(calc(var(--to) * -1.4em));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rolling {
			animation: none;
		}
	}
</style>
