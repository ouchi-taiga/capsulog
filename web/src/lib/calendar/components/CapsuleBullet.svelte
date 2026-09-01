<script lang="ts">
	let {
		color,
		secret = false
	}: {
		color: string;
		/** シークレットは黒いカプセルにする */
		secret?: boolean;
	} = $props();
</script>

<svg
	width="13"
	height="15"
	viewBox="0 0 20 23"
	class="capsule flex-none -rotate-12"
	aria-hidden="true"
>
	<path d="M2 12 h16 v2 a8 8 0 0 1 -16 0 z" fill={secret ? '#6b6276' : 'var(--surface)'} />
	<path d="M2 12 a8 8 0 0 1 16 0 z" fill={secret ? '#4a3d51' : color} />
	<rect x="2" y="11.4" width="16" height="1.2" fill="#000000" opacity="0.08" />
</svg>

<style>
	/* 白いカップが地色に溶けないように、うっすら影を落とす */
	.capsule {
		filter: drop-shadow(1.5px 2px 2px var(--sh));
	}
</style>
