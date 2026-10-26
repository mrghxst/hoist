<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND } from '#lib/brand.ts';
	import PlayScreen, { type Engine } from '#lib/play/PlayScreen.svelte';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Deck } from '#lib/play/game.svelte.ts';
	import { clock, MAX_POINTS, pointsOf, shareText } from '#lib/learn/daily.ts';
	import type { DailyResult } from '#lib/learn/types.ts';

	let date = $state('');
	let copied = $state(false);
	let canShare = $state(false);
	let now = $state(Date.now());

	onMount(() => {
		canShare = typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;
		const t = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(t);
	});

	function begin(ctx: PlayContext, m: Engine): Deck {
		date = m.utcDay(Date.now());
		const pool = ctx.data.countries.filter((c) => c.pack === 'core').map((c) => ({ id: c.id, difficulty: c.difficulty }));
		const ids = m.dailySet(date, pool);
		const prior = ctx.learner.progress.daily[date];
		// One attempt a day: a finished daily opens on its result.
		if (prior && prior.marks.length >= ids.length) return new m.ListDeck('Daily', []);
		return new m.DailyDeck(date, ids, ctx.learner, prior);
	}

	/** "5 h 12 min" until the next UTC midnight. */
	function untilNext(t: number) {
		const next = new Date(t);
		next.setUTCHours(24, 0, 0, 0);
		const min = Math.max(1, Math.round((next.getTime() - t) / 60_000));
		const h = Math.floor(min / 60);
		return h ? `${h} h ${min % 60} min` : `${min} min`;
	}

	async function copy(r: DailyResult) {
		try {
			await navigator.clipboard.writeText(shareText(date, r));
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	async function share(r: DailyResult) {
		try {
			await navigator.share({ text: shareText(date, r) });
		} catch {
			// Cancelled, or not allowed: the copy button is still there.
		}
	}

	const label = (m: string) => (m === 'G' ? 'right, 100 points' : m === 'Y' ? 'right with a letter, 25 points' : 'wrong, 0 points');
</script>

<svelte:head>
	<title>Daily · {BRAND}</title>
	<meta name="description" content="The same ten flags for everyone today. 100 points a flag, one try, then share your score." />
</svelte:head>

<h1 class="visually-hidden">Daily challenge</h1>

<PlayScreen label="Daily" {begin}>
	{#snippet done({ ctx })}
		{@const r = ctx.learner.progress.daily[date]}
		{#if r}
			<p class="done-mark" aria-hidden="true">{pointsOf(r.marks)}</p>
		{/if}
	{/snippet}
	{#snippet finish({ ctx })}
		{@const r = ctx.learner.progress.daily[date]}
		{@const streak = ctx.learner.dailyStreak()}
		{#if r}
			<h2><span class="num">{pointsOf(r.marks)}</span> of {MAX_POINTS} points · <span class="num">{clock(r.ms)}</span></h2>
			<p class="squares" aria-label={[...r.marks].map((m, i) => `${i + 1} ${label(m)}`).join(', ')}>
				{#each [...r.marks] as m, i (i)}<span class="sq {m}"></span>{/each}
			</p>
			<p class="muted small">
				Daily {date}. {r.right} of {r.marks.length} right.
				{#if streak > 1}{streak} days in a row.{/if}
				Next daily in {untilNext(now)}.
			</p>
			<div class="chips">
				{#if canShare}
					<button class="chip primary" onclick={() => share(r)}>Share</button>
				{/if}
				<button class="chip" class:primary={!canShare} onclick={() => copy(r)}>{copied ? 'Copied' : 'Copy result'}</button>
				<a class="chip" href="/">Keep practising</a>
			</div>
			<p class="visually-hidden" role="status">{copied ? 'Result copied.' : ''}</p>
		{/if}
	{/snippet}
</PlayScreen>

<style>
	.num {
		font-variant-numeric: tabular-nums;
	}

	.small {
		font-size: var(--t13);
	}

	.squares {
		display: flex;
		gap: 4px;
	}

	.sq {
		width: 18px;
		height: 18px;
		border-radius: 3px;
		border: 1.5px solid var(--fg);
	}

	.sq.G {
		background: var(--fg);
	}

	.sq.Y {
		background: color-mix(in srgb, var(--fg) 35%, transparent);
	}

	.sq.R {
		border-color: var(--danger);
	}
</style>
