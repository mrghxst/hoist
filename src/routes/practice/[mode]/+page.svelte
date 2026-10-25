<script lang="ts">
	import { BRAND } from '#lib/brand.ts';
	import PlayScreen, { type Engine } from '#lib/play/PlayScreen.svelte';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Deck } from '#lib/play/game.svelte.ts';
	import { FIRST_CHOICE, scopeIds, scopeOf, title } from '#lib/play/scope.ts';
	import { clock } from '#lib/learn/daily.ts';
	import { until } from '#lib/learn/when.ts';

	let { data } = $props();
	let mode = $derived(data.mode);
	let extra = $state(false);

	/** Flags given in the address (`/practice/drill?ids=TD,RO`). */
	function focus(ctx: PlayContext): string[] {
		const ids = new URLSearchParams(location.search).get('ids')?.split(',') ?? [];
		return ids.filter((id) => ctx.data.countries.some((c) => c.id === id));
	}

	function deck(ctx: PlayContext, m: Engine): Deck {
		const territories = ctx.learner.settings.territories;
		const ids = scopeIds(ctx.data, mode.region ?? 'all', territories);
		if (mode.kind === 'speed') {
			// The start panel is the "finished" state of an empty deck.
			return new m.ListDeck('Speed run', []);
		}
		if (mode.kind === 'lookalikes' || mode.kind === 'drill') {
			const plan = ctx.planner.lookalikes(mode.kind === 'drill' ? { focus: focus(ctx) } : {});
			return new m.LearnDeck(mode.title, plan.queue, ctx.learner, m.MODES.review, { tips: true });
		}
		const spec =
			mode.kind === 'capitals'
				? m.MODES.capitals
				: mode.kind === 'reverse'
					? m.MODES.reverse
					: mode.kind === 'easy'
						? m.MODES.easy
						: m.MODES.review;
		const plan = ctx.planner.plan({
			mode: mode.card,
			ids,
			// Review is what is due; Learn new is five new flags, whatever
			// the daily limit; the rest do both, like Play.
			...(mode.kind === 'review' ? { fresh: false } : {}),
			...(mode.kind === 'learn' ? { due: false, freshMax: 5, ignoreDailyLimit: true } : {})
		});
		extra = plan.extra;
		return new m.LearnDeck(plan.extra ? `${mode.title} · extra practice` : mode.title, plan.queue, ctx.learner, spec);
	}

	function speed(ctx: PlayContext, m: Engine, scope: string): Deck {
		const s = scopeOf(scope);
		return new m.SpeedDeck(`Speed run · ${title(s.label)}`, scope, scopeIds(ctx.data, scope), ctx.learner);
	}
</script>

<svelte:head>
	<title>{mode.title} · Practice · {BRAND}</title>
	<meta name="description" content={mode.line} />
</svelte:head>

<h1 class="visually-hidden">{mode.title}</h1>

{#snippet speedDone({ game, engine }: { game: import('#lib/play/game.svelte.ts').Game; engine: Engine })}
	{@const run = game.deck instanceof engine.SpeedDeck ? game.deck.result : null}
	{#if run}
		<p class="done-mark" aria-hidden="true">{clock(run.ms)}</p>
	{:else}
		<p class="done-mark" aria-hidden="true">0:00</p>
	{/if}
{/snippet}

<PlayScreen
	label={mode.title}
	placeholder={mode.kind === 'capitals' ? 'Type the capital' : 'Type the country'}
	picks={mode.kind === 'easy'}
	begin={deck}
	done={mode.kind === 'speed' ? speedDone : undefined}
>
	{#snippet finish({ game, ctx, engine, restart })}
		{#if mode.kind === 'speed'}
			{@const deck = game.deck instanceof engine.SpeedDeck ? game.deck : null}
			{#if deck?.result}
				<h2>
					{deck.result.right} of {deck.result.total} in <span class="num">{clock(deck.result.ms)}</span>{deck.best ? '. A new best!' : '.'}
				</h2>
			{:else}
				<h2>Ready?</h2>
				<p class="muted">Name every flag as fast as you can. A right answer moves on by itself; the clock only runs while a flag waits.</p>
			{/if}
			<div class="chips" role="group" aria-label="Start a run">
				{#each FIRST_CHOICE as id (id)}
					{@const best = ctx.learner.progress.best[id]}
					<button class="chip" class:primary={id === 'all'} onclick={() => restart(speed(ctx, engine, id))}>
						{id === 'all' ? 'All 197' : title(scopeOf(id).label)}
						{#if best}<span class="best num">{best.right}/{best.total} · {clock(best.ms)}</span>{/if}
					</button>
				{/each}
			</div>
		{:else}
			{@const ids = scopeIds(ctx.data, mode.region ?? 'all', ctx.learner.settings.territories)}
			{@const next = ctx.learner.nextDue(mode.card, ids)}
			{#if game.answered}
				<h2>{game.right} of {game.answered} right.</h2>
				<p class="muted">
					{#if extra}Nothing was due, so these were the flags you were most likely to forget.{/if}
					{#if next}Next review {until(next)}.{/if}
				</p>
			{:else if mode.kind === 'review'}
				<h2>Nothing to review yet.</h2>
				<p class="muted">Learn a few flags first; they come back here when they are due.</p>
			{:else}
				<h2>All done here.</h2>
				<p class="muted">Every flag in this set has been learned.</p>
			{/if}
			<div class="chips">
				{#if game.answered || mode.kind !== 'review'}
					<button class="chip primary" onclick={() => restart(deck(ctx, engine))}>Keep going</button>
				{:else}
					<a class="chip primary" href="/practice/learn">Learn new flags</a>
				{/if}
				<a class="chip" href="/practice">All practice</a>
			</div>
		{/if}
	{/snippet}
</PlayScreen>

<style>
	.num {
		font-variant-numeric: tabular-nums;
	}

	.best {
		font-size: var(--t13);
		opacity: 0.7;
	}
</style>
