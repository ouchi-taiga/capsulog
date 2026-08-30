<script lang="ts">
	let original = $state<string | null>(null);
	let result = $state<string | null>(null);
	let status = $state('写真を選ぶと切り抜きが始まる');
	let inferMs = $state<number | null>(null);
	let busy = $state(false);
	let device = $state<'cpu' | 'gpu'>('cpu');
	let model = $state<'isnet' | 'isnet_fp16' | 'isnet_quint8'>('isnet_quint8');
	let lastFile = $state<File | null>(null);

	const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;

	async function run(file: File) {
		busy = true;
		result = null;
		inferMs = null;
		original = URL.createObjectURL(file);

		try {
			status = '切り抜き中（初回はモデルのダウンロードが入る）';
			const { removeBackground } = await import('@imgly/background-removal');
			const t0 = performance.now();
			const blob = await removeBackground(file, { device, model });
			inferMs = Math.round(performance.now() - t0);
			result = URL.createObjectURL(blob);
			status = '完了';
		} catch (err) {
			status = `失敗: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			busy = false;
		}
	}

	function onPick(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		lastFile = file;
		run(file);
	}
</script>

<main class="mx-auto max-w-xl p-4">
	<h1 class="text-xl font-bold">切り抜き検証</h1>
	<p class="mt-1 text-sm text-gray-500">
		棚に使うブラウザ内切り抜きの品質と所要時間を確かめるページ。処理は端末内で完結し、画像はどこにも送られない。
	</p>

	<div class="mt-4 flex flex-wrap gap-4 text-sm">
		<label>
			実行先
			<select bind:value={device} disabled={busy} class="ml-1 rounded border px-1">
				<option value="gpu">GPU（WebGPU）</option>
				<option value="cpu">CPU（WASM）</option>
			</select>
		</label>
		<label>
			モデル
			<select bind:value={model} disabled={busy} class="ml-1 rounded border px-1">
				<option value="isnet">isnet（168MB）</option>
				<option value="isnet_fp16">isnet_fp16（84MB）</option>
				<option value="isnet_quint8">isnet_quint8（42MB・既定）</option>
			</select>
		</label>
		{#if lastFile}
			<button class="rounded border px-2" disabled={busy} onclick={() => lastFile && run(lastFile)}>
				同じ写真で再実行
			</button>
		{/if}
	</div>

	<p class="mt-1 text-xs text-gray-400">
		マルチスレッド: {isolated ? '有効' : '無効（シングルスレッドで動作）'}
	</p>

	<label class="mt-4 block">
		<span class="mb-1 block text-sm font-medium">カプセルトイの写真</span>
		<input type="file" accept="image/*" capture="environment" disabled={busy} onchange={onPick} />
	</label>

	<p class="mt-3 text-sm">{status}</p>
	{#if inferMs !== null}
		<p class="text-sm text-gray-500">切り抜き {inferMs}ms（{device} / {model}）</p>
	{/if}

	<div class="mt-4 grid grid-cols-2 gap-3">
		{#if original}
			<figure>
				<figcaption class="text-xs text-gray-500">元の写真</figcaption>
				<img src={original} alt="元の写真" class="mt-1 rounded border" />
			</figure>
		{/if}
		{#if result}
			<figure>
				<figcaption class="text-xs text-gray-500">切り抜き</figcaption>
				<img src={result} alt="切り抜き結果" class="checker mt-1 rounded border" />
			</figure>
		{/if}
	</div>
</main>

<style>
	/* 透過部分が分かるように市松模様を敷く */
	.checker {
		background-image:
			linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),
			linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);
		background-size: 16px 16px;
		background-position:
			0 0,
			8px 8px;
	}
</style>
