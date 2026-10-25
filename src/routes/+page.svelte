<script lang="ts">
	import { BRAND, ORIGIN, TAGLINE } from '#lib/brand.ts';
	import PlayScreen, { type Engine } from '#lib/play/PlayScreen.svelte';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Deck } from '#lib/play/game.svelte.ts';
	import { FIRST_CHOICE, scopeIds, scopeOf, title } from '#lib/play/scope.ts';
	import { until } from '#lib/learn/when.ts';

	let { data } = $props();

	/** What Play is doing: the first-visit round, or the player's own scope. */
	let stage = $state<'starter' | 'review' | 'list'>('review');

	function review(ctx: PlayContext, m: Engine, scope: string): Deck {
		const ids = scopeIds(ctx.data, scope, ctx.learner.settings.territories);
		const plan = ctx.planner.plan({ mode: 'flag', ids });
		const name = title(scopeOf(scope).label);
		const label = plan.extra ? `${name} · extra practice` : plan.due ? `${name} · ${plan.due} due` : name;
		stage = 'review';
		return new m.LearnDeck(label, plan.queue, ctx.learner, m.MODES.review);
	}

	function begin(ctx: PlayContext, m: Engine): Deck {
		// `?deck=CD,CG` plays a fixed list (used by the end-to-end tests).
		const forced = new URLSearchParams(location.search).get('deck');
		if (forced) {
			stage = 'list';
			return new m.ListDeck('Practice', forced.split(',').filter((id) => ctx.data.countries.some((c) => c.id === id)));
		}
		const scope = ctx.learner.settings.scope;
		if (scope) return review(ctx, m, scope);
		// First visit (PROMPT.md 2.2): ten well-known flags. The answers are
		// scheduled, but leave the day's new flags for the player's choice.
		stage = 'starter';
		return new m.ListDeck('Starter round', ctx.data.starter, (o) => ctx.learner.answer('flag', o.id, o.rating, Date.now(), true));
	}
</script>

<svelte:head>
	<title>{BRAND} · {TAGLINE}</title>
	<meta
		name="description"
		content="See a flag, type the country, and a glass globe flies there. Spaced repetition, a daily challenge, no account."
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

<PlayScreen first={data.first} label="Starter round" {begin}>
	{#snippet finish({ game, ctx, engine, restart })}
		{@const scope = ctx.learner.settings.scope ?? 'all'}
		{#if stage === 'starter'}
			<h2>{game.right} of {game.answered} right.</h2>
			<p class="muted">Now learn all 197, or start with one region. You can change it any time in Practice.</p>
			<div class="chips">
				{#each FIRST_CHOICE as id (id)}
					<button
						class="chip"
						class:primary={id === 'all'}
						onclick={() => {
							ctx.learner.setSettings({ scope: id });
							restart(review(ctx, engine, id));
						}}>{id === 'all' ? 'Learn all 197' : title(scopeOf(id).label)}</button
					>
				{/each}
			</div>
		{:else}
			{@const ids = scopeIds(ctx.data, scope, ctx.learner.settings.territories)}
			{@const next = ctx.learner.nextDue('flag', ids)}
			<h2>{game.answered ? `${game.right} of ${game.answered} right.` : 'All caught up.'}</h2>
			<p class="muted">
				{#if next}Next review {until(next)}.{/if}
				{ctx.learner.newLeftToday('flag') ? '' : 'That was all the new flags for today.'}
			</p>
			<div class="chips">
				<button class="chip primary" onclick={() => restart(review(ctx, engine, scope))}>Keep going</button>
				<a class="chip" href="/practice">Other practice</a>
			</div>
		{/if}
	{/snippet}
</PlayScreen>
