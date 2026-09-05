<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn, type WithoutChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		value,
		label,
		children: childrenProp,
		...restProps
	}: WithoutChild<SelectPrimitive.ItemProps> = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	{value}
	data-slot="select-item"
	class={cn(
		'relative flex w-full cursor-default items-center gap-2 rounded-full py-2 pr-8 pl-3.5 text-note font-bold outline-hidden select-none',
		// 選択中とキーボードの当たっている項目。チップの選択中と同じ見た目に揃える
		'data-highlighted:bg-ground data-selected:bg-accent data-selected:text-on-accent data-selected:shadow-clay-pressed',
		'data-disabled:pointer-events-none data-disabled:opacity-50',
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		'*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2',
		className
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		<span class="absolute end-2 flex size-3.5 items-center justify-center">
			{#if selected}
				<CheckIcon class="size-3.5" />
			{/if}
		</span>
		<span class="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
			{#if childrenProp}
				{@render childrenProp({ selected, highlighted })}
			{:else}
				{label || value}
			{/if}
		</span>
	{/snippet}
</SelectPrimitive.Item>
