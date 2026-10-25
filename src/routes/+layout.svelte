<script lang="ts">
	import '../app.css';
	import TopBar from '#lib/ui/TopBar.svelte';
	import { theme } from '#lib/store/theme.svelte.ts';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => theme.init());

</script>

<div class="stage-bg" aria-hidden="true"></div>
<a class="skip" href="#main">Skip to content</a>
<TopBar />
<main id="main">
	{@render children()}
</main>

<style>
	/* The page is lit from the middle: a soft glow and a dot grid that fade out
	   toward the edges, so every screen gathers around its centre. */
	.stage-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background:
			radial-gradient(60% 55% at 50% 45%, var(--stage-glow), transparent 70%),
			var(--bg);
	}

	.stage-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: radial-gradient(var(--grid-dot) 1px, transparent 1px);
		background-size: 24px 24px;
		background-position: center;
		-webkit-mask-image: radial-gradient(50% 50% at 50% 45%, #000 0%, transparent 100%);
		mask-image: radial-gradient(50% 50% at 50% 45%, #000 0%, transparent 100%);
	}

	main {
		min-height: 100vh;
		min-height: 100dvh;
		padding-top: calc(var(--bar-h) + 24px);
	}

	.skip {
		position: fixed;
		left: 16px;
		top: -48px;
		z-index: 100;
		padding: 8px 12px;
		border-radius: var(--r-btn);
		background: var(--fg);
		color: var(--bg);
		text-decoration: none;
	}

	.skip:focus {
		top: 16px;
	}
</style>
