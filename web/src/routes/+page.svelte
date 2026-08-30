<script lang="ts">
	let { data } = $props();
</script>

<h1>カプセログ</h1>

{#if data.db}
	<p>D1 に接続できた。</p>
	<p>テーブル: {data.tables.length ? data.tables.join(', ') : 'なし'}</p>
{:else}
	<p>D1 に接続できない。</p>
{/if}
