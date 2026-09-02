<script lang="ts">
	let { code, name }: { code: string; name: string } = $props();

	// メーカーの識別色。テーマによらず固定
	const COLORS: Record<string, string> = {
		kitan: 'bg-[#f2766b]',
		tarlin: 'bg-[#64bfae]',
		takaratomy: 'bg-[#8a92e3]',
		qualia: 'bg-[#e8a94f]',
		parade: 'bg-[#e884b8]'
	};
</script>

<span
	class={[
		'inline-block rounded-full px-2.5 py-0.5 text-note font-extrabold text-white',
		COLORS[code] ?? 'bg-faint'
	]}
>
	{name}
</span>
