<script lang="ts">
	let { title, line }: { title: string; line: string } = $props();
</script>

<section class="placeholder">
	<div class="card glass">
		<h1>{title}</h1>
		<p class="muted">{line}</p>
	</div>
</section>

<style>
	.placeholder {
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
		gap: 8px;
	}
</style>
