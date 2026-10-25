<script lang="ts">
	/**
	 * A flag at its true proportions, inside a 1 px hairline so white flags
	 * read on white (PROMPT.md 6.2). Never cropped, corners at most 2 px.
	 */
	interface Props {
		src: string;
		ratio: number;
		alt: string;
		/** Largest box the flag may fill, in px. */
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
	{src}
	{alt}
	width={Math.round(w)}
	height={Math.round(h)}
	style:width="{w}px"
	style:aspect-ratio={ratio}
	loading={eager ? 'eager' : 'lazy'}
	fetchpriority={eager ? 'high' : 'auto'}
	decoding="async"
	draggable="false"
/>

<style>
	.flag {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: 2px;
		/* The hairline: outside the flag, so it never covers flag colours. */
		outline: 1px solid var(--overlay);
		outline-offset: 0;
		user-select: none;
	}
</style>
