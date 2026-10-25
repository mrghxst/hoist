<script lang="ts">
	import { BRAND, TAGLINE } from '#lib/brand.ts';
	import GlobeView from '#lib/ui/GlobeView.svelte';

	let { data } = $props();
	const flag = data.first;

	let innerWidth = $state(1440);
	let offsetY = $derived(innerWidth >= 900 ? -70 : 0);
</script>

<svelte:head>
	<title>{BRAND} · {TAGLINE}</title>
	<meta
		name="description"
		content="See a flag, type the country, and a glass globe flies there. Spaced repetition, a daily challenge, no account."
	/>
	<link rel="preload" href="/geo/overview.topo.json" as="fetch" crossorigin="anonymous" />
	<link rel="preload" href="/geo/land-dots.bin" as="fetch" crossorigin="anonymous" />
</svelte:head>

<svelte:window bind:innerWidth />

<div class="play">
	<div class="stage">
		<GlobeView label="Globe" autoRotate {offsetY} />
	</div>

	<section class="dock glass" aria-label="Flag">
		<div class="flag-card">
			<img class="flag" src={flag.flag} alt="Flag to name" width="480" height={Math.round(480 / flag.ratio)} style:aspect-ratio={flag.ratio} />
		</div>
	</section>
</div>

<style>
	.play {
		position: relative;
		min-height: calc(100dvh - var(--bar-h) - 24px);
	}

	.stage {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	.dock {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		width: min(560px, calc(100% - 32px));
		padding: 24px;
		z-index: 1;
		border-radius: 20px;
	}

	.flag-card {
		display: grid;
		place-items: center;
		height: 200px;
	}

	.flag {
		display: block;
		max-height: 200px;
		max-width: 100%;
		width: auto;
		height: auto;
		border-radius: 2px;
		box-shadow: 0 0 0 1px var(--overlay);
	}
</style>
