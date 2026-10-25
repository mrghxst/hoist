<script lang="ts">
	/**
	 * A flag at its true proportions, inside a 1 px hairline so white flags
	 * read on white (PROMPT.md 6.2). Never cropped, corners at most 2 px.
	 * No hairline on a flag taller than it is wide: the only one is Nepal's,
	 * which is not a rectangle, and a box would draw a shape it does not have.
	 * Going by the ratio (already in the page) names no country.
	 */
	interface Props {
		src: string;
		ratio: number;
		alt: string;
		/**
		 * Largest box the flag may fill, in px. A parent can override it from
		 * CSS with `--flag-w` and `--flag-h` (media queries), so the size in the
		 * prerendered HTML is already right on every screen (CLS 0).
		 */
		maxWidth?: number;
		maxHeight?: number;
		eager?: boolean;
	}

	let { src, ratio, alt, maxWidth = 320, maxHeight = 200, eager = false }: Props = $props();

	let w = $derived(Math.min(maxWidth, maxHeight * ratio));
	let h = $derived(w / ratio);
</script>

<img
	class="flag"
	class:bare={ratio < 1}
	{src}
	{alt}
	width={Math.round(w)}
	height={Math.round(h)}
	style:--r={ratio}
	style:--mw="{maxWidth}px"
	style:--mh="{maxHeight}px"
	style:aspect-ratio={ratio}
	loading={eager ? 'eager' : 'lazy'}
	fetchpriority={eager ? 'high' : 'auto'}
	decoding="async"
	draggable="false"
/>

<style>
	.flag {
		display: block;
		width: min(var(--flag-w, var(--mw)), calc(var(--flag-h, var(--mh)) * var(--r)));
		max-width: 100%;
		height: auto;
		border-radius: 2px;
		/* The hairline: outside the flag, so it never covers flag colours. */
		outline: 1px solid var(--overlay);
		outline-offset: 0;
		user-select: none;
	}

	.bare {
		outline: none;
		border-radius: 0;
	}
</style>
