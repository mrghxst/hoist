<script lang="ts" module>
	import type { Globe as GlobeClass, Markers, Target } from '#lib/globe/Globe.ts';
	export type { Markers, Target };
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		target?: Target | null;
		markers?: Markers | null;
		autoRotate?: boolean;
		mastery?: Map<string, 0 | 1 | 2 | 3> | null;
		/** Move the globe centre up (negative) to leave room below it. */
		offsetY?: number;
		label: string;
		controls?: boolean;
		/** Fixed start view, for stable screenshots. */
		view?: { lon: number; lat: number; zoom?: number };
		oninteract?: () => void;
		onready?: (globe: GlobeClass) => void;
		onerror?: (error: unknown) => void;
	}

	let {
		target = null,
		markers = null,
		autoRotate = false,
		mastery = null,
		offsetY = 0,
		label,
		controls = true,
		view,
		oninteract,
		onready,
		onerror
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let wrapper: HTMLDivElement;
	let globe = $state<GlobeClass | null>(null);
	let ready = $state(false);
	let failed = $state(false);

	onMount(() => {
		let disposed = false;
		let detailLoading = false;
		const cleanups: (() => void)[] = [];

		(async () => {
			try {
				const [{ Globe }, data] = await Promise.all([
					import('#lib/globe/Globe.ts'),
					import('#lib/globe/data.ts')
				]);
				if (disposed) return;
				const g = new Globe(canvas, {
					autoRotate,
					view,
					keyTarget: wrapper,
					onInteract: () => oninteract?.(),
					onViewChange: (cam) => {
						if (cam.zoom > 1.8 && !detailLoading) {
							detailLoading = true;
							data.loadDetail().then((d) => g.setDetail(d)).catch(() => {});
						}
					}
				});
				globe = g;
				g.resize(offsetY);
				const ro = new ResizeObserver(() => g.resize(offsetY));
				ro.observe(canvas);
				cleanups.push(() => ro.disconnect());

				// Follow theme changes: the toggle and the system setting.
				const mo = new MutationObserver(() => g.setTheme());
				mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
				const mq = matchMedia('(prefers-color-scheme: dark)');
				const onScheme = () => g.setTheme();
				mq.addEventListener('change', onScheme);
				cleanups.push(() => mo.disconnect(), () => mq.removeEventListener('change', onScheme));
				// Fonts change label metrics once loaded.
				document.fonts?.ready.then(() => g.setTheme());

				g.setData(await data.loadGlobeData());
				if (disposed) return;
				ready = true;
				if (new URLSearchParams(location.search).has('test')) {
					(window as unknown as { __globe: GlobeClass }).__globe = g;
				}
				onready?.(g);
			} catch (e) {
				failed = true;
				onerror?.(e);
			}
		})();

		return () => {
			disposed = true;
			for (const c of cleanups) c();
			globe?.destroy();
		};
	});

	$effect(() => {
		globe?.resize(offsetY);
	});

	$effect(() => {
		if (!globe) return;
		if (target) globe.flyTo(target);
		else globe.setTarget(null);
	});

	$effect(() => {
		globe?.showMarkers(markers);
	});

	$effect(() => {
		globe?.setMastery(mastery);
	});

	$effect(() => {
		globe?.setAutoRotate(autoRotate);
	});

	function recenter() {
		if (!globe) return;
		if (target) globe.flyTo(target);
		else globe.flyTo({ id: '', centre: [globe.camera.lon, globe.camera.lat], zoom: 1 });
	}
</script>

<div class="globe" class:ready class:failed>
	<!-- Focus the globe to turn it with the arrow keys and zoom with + and −. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex: it takes keys, so it must be focusable -->
	<div
		class="focus"
		bind:this={wrapper}
		tabindex="0"
		role="application"
		aria-roledescription="globe"
		aria-label="{label}. Arrow keys turn it, plus and minus zoom."
	>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>
	</div>
	{#if controls && ready}
		<div class="controls glass" role="group" aria-label="Globe controls">
			<button type="button" aria-label="Zoom out" onclick={() => globe?.zoomBy(1 / 1.5)}>
				<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
			</button>
			<button type="button" aria-label="Recentre" onclick={recenter}>
				<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
			</button>
			<button type="button" aria-label="Zoom in" onclick={() => globe?.zoomBy(1.5)}>
				<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 8h9M8 3.5v9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.globe {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.focus {
		width: 100%;
		height: 100%;
		border-radius: 24px;
		outline: none;
	}

	.focus:focus-visible {
		outline: 2px solid var(--fg);
		outline-offset: -2px;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
		cursor: grab;
		opacity: 0;
		transition: opacity 400ms var(--ease);
		border-radius: 24px;
	}

	canvas:active {
		cursor: grabbing;
	}

	.ready canvas {
		opacity: 1;
	}

	.controls {
		position: absolute;
		right: 16px;
		bottom: 16px;
		display: flex;
		gap: 2px;
		padding: 4px;
		border-radius: 999px;
		animation: in 300ms var(--ease);
	}

	.controls button {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		transition:
			color 150ms var(--ease),
			background-color 150ms var(--ease);
	}

	.controls button:hover {
		color: var(--fg);
		background: var(--overlay);
	}

	@keyframes in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
</style>
