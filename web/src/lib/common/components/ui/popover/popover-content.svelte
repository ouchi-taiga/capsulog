<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import PopoverPortal from './popover-portal.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 8,
		align = 'end',
		// 画面端に貼り付かせない。クレイの影は外側に広がるため余白が要る
		collisionPadding = 16,
		portalProps,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
	} = $props();
</script>

<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		{collisionPadding}
		class={cn(
			// 幅は検索欄の行に揃える。画面が狭いときは端の余白を除いた全幅まで縮む。
			// 影は色エリア用。白いハイライトを載せると地色から浮いて滲む
			'anchor-pop z-50 flex max-h-[70dvh] w-[calc(100vw-2rem)] max-w-xl flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-5 text-ink shadow-clay-on-color outline-none',
			className
		)}
		{...restProps}
	/>
</PopoverPortal>
