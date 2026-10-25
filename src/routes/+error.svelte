<script lang="ts">
	import { page } from '$app/state';
	import { BRAND } from '#lib/brand.ts';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Error'} · {BRAND}</title>
</svelte:head>

<section class="wrap">
	<div class="card glass">
		<p class="code">{page.status}</p>
		<h1>{page.status === 404 ? 'This page is off the map.' : 'Something went wrong.'}</h1>
		<p class="muted">
			{page.status === 404 ? 'No country here. Try one of these instead.' : page.error?.message}
		</p>
		<div class="actions">
			<a class="btn primary" href="/">Play</a>
			<a class="btn" href="/flags">All flags</a>
		</div>
	</div>
</section>

<style>
	.wrap {
		min-height: calc(100dvh - var(--bar-h) - 48px);
		display: grid;
		place-items: center;
		padding: 0 16px 48px;
	}
	.card {
		width: min(560px, 100%);
		padding: 40px 32px;
		text-align: center;
		display: grid;
		gap: 12px;
		justify-items: center;
	}
	.code {
		font-family: var(--mono);
		color: var(--muted);
		font-size: var(--t13);
	}
	.actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
</style>
