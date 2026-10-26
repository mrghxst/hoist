<script lang="ts">
	/**
	 * Accuracy of recent runs of one length, oldest on the left (owner, M8).
	 * One series, so no legend: the caption names it. Ink only (flags are the
	 * only colour): earlier runs faded, the highlighted one in full ink and
	 * labelled. Every column has a tooltip on hover and focus, and a table
	 * carries the same numbers for screen readers.
	 */
	import { clock } from '#lib/learn/daily.ts';
	import type { RunResult } from '#lib/learn/types.ts';
	import { accuracy } from './run.ts';

	interface Props {
		runs: RunResult[];
		/** `at` of the run to stand out (default: the latest). */
		highlight?: number;
		height?: number;
		caption: string;
	}

	let { runs, highlight, height = 132, caption }: Props = $props();

	let width = $state(280);
	let hover = $state<number | null>(null);
	let plotEl = $state<HTMLDivElement>();

	// Not `bind:clientWidth`: its helper would join the Svelte code every
	// page loads first, though this chart loads later with the engine.
	$effect(() => {
		if (!plotEl) return;
		const ro = new ResizeObserver(([e]) => (width = e!.contentRect.width));
		ro.observe(plotEl);
		return () => ro.disconnect();
	});

	const TOP = 18;
	const BOTTOM = 4;
	const GAP = 2;
	const MAX_BAR = 24;

	let mark = $derived(highlight ?? runs.at(-1)?.at);
	let slot = $derived(runs.length ? width / runs.length : width);
	let bar = $derived(Math.max(2, Math.min(MAX_BAR, slot - GAP)));
	let plot = $derived(height - TOP - BOTTOM);
	let y = (pct: number) => TOP + plot * (1 - pct / 100);
	let base = $derived(TOP + plot);

	/** A column with a 4 px round top, square at the baseline. */
	function column(x: number, top: number) {
		const r = Math.min(4, bar / 2, base - top);
		if (base - top < 0.5) return '';
		return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bar - r}Q${x + bar},${top} ${x + bar},${top + r}V${base}Z`;
	}

	const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	let tip = $derived(hover === null ? null : runs[hover]);
</script>

<figure class="chart">
	<figcaption>{caption}</figcaption>
	<div class="plot" bind:this={plotEl} style:height="{height}px">
		<svg {width} {height} aria-hidden="true">
			{#each [0, 50, 100] as g (g)}
				<line x1="0" x2={width} y1={y(g)} y2={y(g)} class="grid" />
			{/each}
			{#each runs as r, i (r.at)}
				{@const x = i * slot + (slot - bar) / 2}
				{@const top = y(accuracy(r))}
				<path d={column(x, top)} class="col" class:on={r.at === mark} class:hover={hover === i} />
				{#if r.at === mark}
					<text x={Math.min(Math.max(x + bar / 2, 14), width - 14)} y={top - 5} class="value">{accuracy(r)}%</text>
				{/if}
			{/each}
		</svg>
		<!-- Hit targets: the whole slot, taller than the column. -->
		<div class="hits">
			{#each runs as r, i (r.at)}
				<button
					type="button"
					class="hit"
					style:width="{slot}px"
					aria-label="{accuracy(r)}%, {r.right} of {r.n}, {clock(r.ms)}, {day(r.at)}"
					onpointerenter={() => (hover = i)}
					onpointerleave={() => (hover = null)}
					onfocus={() => (hover = i)}
					onblur={() => (hover = null)}
					tabindex="-1"
				></button>
			{/each}
		</div>
		{#if tip && hover !== null}
			<div class="tip" style:left="{Math.min(Math.max(hover * slot + slot / 2, 60), width - 60)}px">
				<strong class="num">{accuracy(tip)}%</strong>
				<span class="num">{tip.right}/{tip.n} · {clock(tip.ms)}</span>
				<span>{day(tip.at)}</span>
			</div>
		{/if}
	</div>
	<table class="visually-hidden">
		<caption>{caption}</caption>
		<thead><tr><th>Date</th><th>Right</th><th>Accuracy</th><th>Time</th></tr></thead>
		<tbody>
			{#each runs as r (r.at)}
				<tr><td>{day(r.at)}</td><td>{r.right} of {r.n}</td><td>{accuracy(r)}%</td><td>{clock(r.ms)}</td></tr>
			{/each}
		</tbody>
	</table>
</figure>

<style>
	.chart {
		margin: 0;
		width: 100%;
		display: grid;
		gap: 6px;
	}

	figcaption {
		font-size: var(--t13);
		color: var(--muted);
		text-align: left;
	}

	.plot {
		position: relative;
		width: 100%;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.grid {
		stroke: var(--border);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.col {
		fill: var(--fg);
		opacity: 0.28;
		transition: opacity 150ms var(--ease);
	}

	.col.on,
	.col.hover {
		opacity: 1;
	}

	.value {
		fill: var(--fg);
		font-size: 11px;
		font-weight: 600;
		text-anchor: middle;
		font-variant-numeric: tabular-nums;
	}

	.hits {
		position: absolute;
		inset: 0;
		display: flex;
	}

	.hit {
		height: 100%;
		border: 0;
		padding: 0;
		background: none;
		cursor: default;
	}

	.tip {
		position: absolute;
		top: -6px;
		transform: translate(-50%, -100%);
		display: grid;
		gap: 1px;
		padding: 6px 10px;
		border-radius: 8px;
		background: var(--bg);
		border: 1px solid var(--border-strong);
		font-size: 12px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 2;
		text-align: left;
	}

	.tip span {
		color: var(--muted);
	}

	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
