<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import type { WithoutChildrenOrChild } from '$lib/utils.js';
	import SelectPortal from './select-portal.svelte';
	import SelectScrollDownButton from './select-scroll-down-button.svelte';
	import SelectScrollUpButton from './select-scroll-up-button.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		// 画面端に貼り付かせない。クレイの影は外側に広がるため余白が要る
		collisionPadding = 16,
		portalProps,
		children,
		// 背面のスクロールを止めない。パネルはトリガーに追従するため、動いても破綻しない
		preventScroll = false,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		{collisionPadding}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			'relative isolate z-50 min-w-36 overflow-x-hidden overflow-y-auto rounded-2xl bg-surface p-1.5 text-ink shadow-clay',
			className
		)}
		{...restProps}
	>
		<SelectScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn(
				'h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) scroll-my-1'
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<SelectScrollDownButton />
	</SelectPrimitive.Content>
</SelectPortal>
