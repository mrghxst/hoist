<script lang="ts">
	/**
	 * The end of a run or a speed run on Play (owner, M8): the score, the
	 * time, the personal best, the flags missed, and a result to share. A
	 * run's share text carries a link to the same flags, so friends (or a
	 * class) can play exactly that run and compare.
	 */
	import { onMount } from 'svelte';
	import { clock, squares } from '#lib/learn/daily.ts';
	import type { Game } from './game.svelte.ts';
	import type { RunDeck, SpeedDeck } from './decks.ts';
	import { accuracy, runShareText, speedShareText } from './run.ts';
	import { scopeOf, title } from './scope.ts';

	interface Props {
		game: Game;
		deck: RunDeck | SpeedDeck;
		speed: boolean;
		onnext: () => void;
	}

	let { game, deck, speed, onnext }: Props = $props();

	let again = $state<HTMLButtonElement>();
	let copied = $state(false);
	let canShare = $state(false);

	onMount(() => {
		canShare = typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;
		// Enter starts the next one, like a typing test.
		again?.focus({ preventScroll: true });
	});

	let run = $derived(speed ? null : (deck as RunDeck).result);
	let fast = $derived(speed ? (deck as SpeedDeck).result : null);
	let missed = $derived.by(() => {
		if (!run) return [];
		const ids = (deck as RunDeck).ids;
		return [...run.marks].flatMap((m, i) => (m === 'R' ? [ids[i]!] : []));
	});
	let previous = $derived(speed ? undefined : (deck as RunDeck).previous);
	let text = $derived(
		run ? runShareText(run) : fast ? speedShareText(title(scopeOf((deck as SpeedDeck).scope).label), fast) : ''
	);

	async function share() {
		if (canShare) {
			try {
				await navigator.share({ text });
				return;
			} catch {
				// Cancelled, or not allowed: copy instead.
			}
		}
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	const names = (ids: string[]) => ids.map((id) => game.byId.get(id)?.name ?? id);
</script>

{#if run}
	<h2>
		<span class="num">{run.right} of {run.n}</span><span class="sep" aria-hidden="true">·</span><span class="num">{accuracy(run)}%</span>
		{#if deck.best && previous}<span class="badge">New best</span>{/if}
	</h2>
	<p class="muted">
		<span class="num">{clock(run.ms)}</span>, <span class="num">{(run.ms / 1000 / run.n).toFixed(1)}</span> s a flag.
		{#if !previous}Your first run of {run.n}.{:else if !deck.best}Best: <span class="num">{previous.right}/{previous.n} in {clock(previous.ms)}</span>.{/if}
	</p>
	{#if run.n <= 30}
		<p class="squares" aria-hidden="true">{squares(run.marks)}</p>
	{/if}
	{#if missed.length}
		<p class="muted small">
			Missed: {names(missed.slice(0, 6)).join(', ')}{missed.length > 6 ? ` and ${missed.length - 6} more` : ''}.
			<a href="/practice/drill?ids={missed.join(',')}">Practise them</a>
		</p>
	{/if}
{:else if fast}
	<h2>
		<span class="num">{fast.right} of {fast.total}</span> in <span class="num">{clock(fast.ms)}</span>{#if deck.best}<span class="badge"
				>New best</span
			>{/if}
	</h2>
	<p class="muted">{title(scopeOf((deck as SpeedDeck).scope).label)}. Letters come slowly here: the first after 10 s.</p>
{/if}

<div class="chips">
	<button class="chip primary" bind:this={again} onclick={onnext}>{speed ? 'Again' : 'Next run'}<kbd>⏎</kbd></button>
	<button class="chip" onclick={share}>{copied ? 'Copied' : run ? 'Challenge friends' : 'Share'}</button>
</div>
<p class="visually-hidden" role="status">{copied ? 'Result copied, with a link to the same flags.' : ''}</p>

<style>
	h2 {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 8px;
	}

	.sep {
		opacity: 0.5;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.badge {
		font-size: var(--t13);
		font-weight: 500;
		letter-spacing: 0;
		padding: 2px 10px;
		border-radius: 999px;
		border: 1px solid var(--fg);
		color: var(--fg);
	}

	.squares {
		font-size: 13px;
		letter-spacing: 1px;
		line-height: 1.2;
		word-break: break-all;
	}

	.small {
		font-size: var(--t13);
	}

	.chip:has(kbd) {
		padding: 0 10px 0 16px;
	}

	.chip kbd {
		margin-left: 2px;
		font-size: 11px;
		color: inherit;
		background: none;
		border-color: color-mix(in srgb, currentColor 40%, transparent);
	}
</style>
