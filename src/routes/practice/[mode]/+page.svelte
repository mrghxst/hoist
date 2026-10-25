<script lang="ts">
	import { BRAND } from '#lib/brand.ts';
	import PlayScreen, { type Engine } from '#lib/play/PlayScreen.svelte';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Deck } from '#lib/play/game.svelte.ts';
	import { scopeIds } from '#lib/play/scope.ts';
	import { until } from '#lib/learn/when.ts';

	let { data } = $props();
	let mode = $derived(data.mode);
	let extra = $state(false);

	function deck(ctx: PlayContext, m: Engine): Deck {
		const territories = ctx.learner.settings.territories;
		const ids = scopeIds(ctx.data, mode.region ?? 'all', territories);
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
	{/snippet}
</PlayScreen>
