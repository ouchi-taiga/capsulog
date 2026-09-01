<script lang="ts">
	let {
		title,
		note,
		large = false
	}: {
		title: string;
		/** 件数などの添え字 */
		note?: string;
		/** 月見出しのような上位の見出しは大きくする */
		large?: boolean;
	} = $props();
</script>

<h2 class="flex items-baseline gap-2 px-1 pb-2.5">
	<span class={['font-extrabold', large ? '' : 'text-sm']}>{title}</span>
	{#if note}<span class="text-xs text-faint">{note}</span>{/if}
	<span class="deco-wave ml-1.5 h-2 flex-1" aria-hidden="true"></span>
</h2>
