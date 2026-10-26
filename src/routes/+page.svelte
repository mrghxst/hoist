<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND, ORIGIN, TAGLINE } from '#lib/brand.ts';
	import PlayScreen, { type Engine } from '#lib/play/PlayScreen.svelte';
	import RunBar, { type Kind } from '#lib/play/RunBar.svelte';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Deck, Game } from '#lib/play/game.svelte.ts';
	import { DEFAULT_RUN } from '#lib/play/lengths.ts';
	import { scopeIds, scopeOf, title } from '#lib/play/scope.ts';
	import { readSettings } from '#lib/store/storage.ts';

	let { data } = $props();

	let screen = $state<ReturnType<typeof PlayScreen>>();
	let game = $state<Game | null>(null);
	let ctx = $state<PlayContext | null>(null);
	let engine = $state.raw<Engine>();

	let kind = $state<Kind>('run');
	let length = $state(DEFAULT_RUN);
	let scope = $state('all');

	onMount(() => {
		// The bar shows the saved length at once; the learner validates it later.
		const saved = (readSettings() as { runLength?: unknown }).runLength;
		if (typeof saved === 'number' && saved >= 3 && saved <= data.pool) length = saved;
	});

	/** A run is under way: the bar steps aside until it ends. */
	let running = $derived(!!game && !game.finished && (game.answered > 0 || game.input !== ''));

	function run(c: PlayContext, m: Engine, n: number, seed = m.newSeed(), challenge = false): Deck {
		const ids = m.runIds(m.runPool(c.data), seed, n);
		return new m.RunDeck(challenge ? `Challenge · ${ids.length} flags` : `${ids.length} flags`, ids, seed, c.learner);
	}

	function speed(c: PlayContext, m: Engine, id: string): Deck {
		return new m.SpeedDeck(`Speed run · ${title(scopeOf(id).label)}`, id, scopeIds(c.data, id), c.learner);
	}

	function begin(c: PlayContext, m: Engine): Deck {
		ctx = c;
		engine = m;
		const q = new URLSearchParams(location.search);
		// `?deck=CD,CG` plays a fixed list (used by the end-to-end tests).
		const forced = q.get('deck');
		if (forced) return new m.ListDeck('Practice', forced.split(',').filter((id) => c.data.countries.some((x) => x.id === id)));
		const saved = c.learner.settings.runLength;
		if (saved && saved <= data.pool) length = saved;
		// A challenge link (`/?n=20&seed=…`) plays exactly that run.
		const challenge = m.parseSeed(q.get('seed'));
		const n = (challenge !== null && m.parseLength(q.get('n'), data.pool)) || length;
		length = n;
		// The inline script already showed this run's first flag.
		const seed = window.__hoistRun?.seed ?? challenge ?? m.newSeed();
		return run(c, m, n, seed, challenge !== null);
	}

	/**
	 * Leave a challenge link once the player picks something else: only the
	 * query goes, SvelteKit's history entry stays. Not `$app/navigation`:
	 * importing it, even lazily, adds about 1 KB and two requests to the
	 * JavaScript every page loads first (LCP).
	 */
	function leaveChallenge() {
		if (location.search) history.replaceState(history.state, '', '/');
	}

	function setKind(k: Kind) {
		if (!ctx || !engine) return;
		kind = k;
		leaveChallenge();
		screen?.restart(k === 'run' ? run(ctx, engine, length) : speed(ctx, engine, scope));
	}

	function setLength(n: number) {
		if (!ctx || !engine) return;
		kind = 'run';
		length = n;
		ctx.learner.setSettings({ runLength: n });
		leaveChallenge();
		screen?.restart(run(ctx, engine, n));
	}

	function setScope(id: string) {
		if (!ctx || !engine) return;
		kind = 'speed';
		scope = id;
		leaveChallenge();
		screen?.restart(speed(ctx, engine, id));
	}

	function again() {
		if (kind === 'speed') setScope(scope);
		else setKind('run');
	}
</script>

<svelte:head>
	<title>{BRAND} · {TAGLINE}</title>
	<meta
		name="description"
		content="See a flag, type the country, and a glass globe flies there. Quick runs of 10, 20 or 30 flags, speed runs, a daily challenge, no account."
	/>
	<link rel="canonical" href="{ORIGIN}/" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="{BRAND} · {TAGLINE}" />
	<meta property="og:description" content="See a flag, type the country, and a glass globe flies there." />
	<meta property="og:url" content="{ORIGIN}/" />
	<meta property="og:image" content="{ORIGIN}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<h1 class="visually-hidden">{BRAND}: name the flag</h1>

<RunBar
	{kind}
	{length}
	{scope}
	max={data.pool}
	hidden={running}
	busy={!ctx}
	onkind={setKind}
	onlength={setLength}
	onscope={setScope}
/>

<PlayScreen bind:this={screen} bind:game randomFirst label="{length} flags" {begin}>
	{#snippet tools()}
		{#if running}
			<button class="restart" onclick={again} aria-label="Restart" title="Restart">
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
					><path
						d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
			</button>
		{/if}
	{/snippet}
	{#snippet done({ game, ctx, engine })}
		{@const deck = game.deck}
		{#if deck instanceof engine.RunDeck && deck.result}
			{@const runs = ctx.learner.runs(deck.result.n).slice(-20)}
			{#if runs.length > 1}
				<engine.RunChart {runs} highlight={deck.result.at} height={120} caption="Your last {runs.length} runs of {deck.result.n}" />
			{:else}
				<p class="done-mark" aria-hidden="true">{Math.round((deck.result.right / deck.result.n) * 100)}%</p>
			{/if}
		{:else if deck instanceof engine.SpeedDeck && deck.result}
			<p class="done-mark" aria-hidden="true">{deck.result.right}/{deck.result.total}</p>
		{:else}
			<p class="done-mark" aria-hidden="true">{game.right}/{game.answered}</p>
		{/if}
	{/snippet}
	{#snippet finish({ game, engine })}
		{@const deck = game.deck}
		{#if deck instanceof engine.RunDeck || deck instanceof engine.SpeedDeck}
			<engine.RunResults {game} {deck} speed={deck instanceof engine.SpeedDeck} onnext={again} />
		{:else}
			<h2>{game.right} of {game.answered} right.</h2>
			<div class="chips">
				<button class="chip primary" onclick={() => setKind('run')}>Play a run</button>
			</div>
		{/if}
	{/snippet}
</PlayScreen>

<style>
	.restart {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin: -2px 0;
		border: 0;
		border-radius: 6px;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.restart:hover {
		color: var(--fg);
	}
</style>
