<script lang="ts">
	import { page } from '$app/state';
	import { BRAND } from '#lib/brand.ts';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Error'} · {BRAND}</title>
</svelte:head>

<section class="error-page">
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
