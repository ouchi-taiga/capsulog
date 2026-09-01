<script lang="ts">
	let {
		title,
		note
	}: {
		title: string;
		/** 件数などの添え字 */
		note?: string;
	} = $props();
</script>

<h2 class="flex items-baseline gap-2 px-1 pb-2.5">
	<span class="text-heading font-extrabold">{title}</span>
	{#if note}<span class="text-note text-faint">{note}</span>{/if}
	<span class="deco-wave ml-1.5 h-2 flex-1" aria-hidden="true"></span>
</h2>
