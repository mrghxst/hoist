<script lang="ts">
	import { BRAND } from '#lib/brand.ts';
	import PlayScreen, { type Engine } from '#lib/play/PlayScreen.svelte';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Deck } from '#lib/play/game.svelte.ts';
	import { scopeIds, scopeOf, title } from '#lib/play/scope.ts';
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
		// Today covers the player's own scope (Practice settings); a region its region.
		const scope = mode.kind === 'today' ? (ctx.learner.settings.scope ?? 'all') : (mode.region ?? 'all');
		const ids = scopeIds(ctx.data, scope, territories);
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
			// the daily limit; the rest do both.
			...(mode.kind === 'review' ? { fresh: false } : {}),
			...(mode.kind === 'learn' ? { due: false, freshMax: 5, ignoreDailyLimit: true } : {})
		});
		extra = plan.extra;
		const name = mode.kind === 'today' ? `Today · ${title(scopeOf(scope).label)}` : mode.title;
		const label = plan.extra ? `${name} · extra practice` : mode.kind === 'today' && plan.due ? `${name} · ${plan.due} due` : name;
		return new m.LearnDeck(label, plan.queue, ctx.learner, spec);
	}
</script>

<svelte:head>
	<title>{mode.title} · Practice · {BRAND}</title>
	<meta name="description" content={mode.line} />
</svelte:head>

<h1 class="visually-hidden">{mode.title}</h1>

<PlayScreen
	label={mode.title}
	placeholder={mode.kind === 'capitals' ? 'Type the capital' : 'Type the country'}
	picks={mode.kind === 'easy'}
	begin={deck}
>
	{#snippet finish({ game, ctx, engine, restart })}
		{@const scope = mode.kind === 'today' ? (ctx.learner.settings.scope ?? 'all') : (mode.region ?? 'all')}
		{@const ids = scopeIds(ctx.data, scope, ctx.learner.settings.territories)}
		{@const next = ctx.learner.nextDue(mode.card, ids)}
		{#if game.answered}
			<h2>{game.right} of {game.answered} right.</h2>
			<p class="muted">
				{#if extra}Nothing was due, so these were the flags you were most likely to forget.{/if}
				{#if next}Next review {until(next)}.{/if}
				{#if mode.kind === 'today' && !ctx.learner.newLeftToday('flag')}That was all the new flags for today.{/if}
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
	{/snippet}
</PlayScreen>

