<script lang="ts">
	/**
	 * The answer side after an answer (or on a study card): the name, the
	 * capital and largest city, and the button to move on. Loaded with the
	 * quiz engine, after first paint.
	 */
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import type { GameCountry } from '#lib/data/types.ts';
	import type { Outcome } from './game.svelte.ts';

	interface Props {
		current: GameCountry;
		/** Null on a study card. */
		outcome: Outcome | null;
		/** Show the button on phones too (no keyboard up to press Enter on). */
		always: boolean;
		onnext: () => void;
		button?: HTMLButtonElement;
	}

	let { current, outcome, always, onnext, button = $bindable() }: Props = $props();
</script>

{#snippet facts(first: { dt: string; dd: string } | null)}
	<dl class="facts">
		{#if first}
			<div>
				<dt>{first.dt}</dt>
				<dd>{first.dd}</dd>
			</div>
		{:else}
			<div>
				<dt>Capital</dt>
				<dd>
					{current.capital.name}
					{#if current.capital.note}<span class="note">{current.capital.note}</span>{/if}
				</dd>
			</div>
		{/if}
		{#if first && (current.capital.note || current.capital.alts)}
			<div>
				<dt>Note</dt>
				<dd><span class="note">{current.capital.note ?? `Also accepted: ${current.capital.alts?.join(', ')}`}</span></dd>
			</div>
		{/if}
		<div>
			<dt>Largest city</dt>
			<dd>{current.same ? 'Also the capital' : current.largest.name}</dd>
		</div>
	</dl>
{/snippet}

<div class="result">
	{#if !outcome}
		<p class="eyebrow">New flag</p>
		<p class="verdict">{current.name}</p>
		{@render facts(null)}
		<button class="next study" bind:this={button} onclick={onnext}><span>Got it</span><kbd>⏎</kbd></button>
	{:else}
		{#if outcome.ask === 'capital'}
			<p class="verdict" class:wrong={!outcome.correct}>
				<span class="mark" aria-hidden="true">{outcome.correct ? '✓' : '✗'}</span>{current.capital.name}
			</p>
			{#if outcome.typo}
				<p class="small muted">Spelling: {current.capital.name}</p>
			{/if}
			{#if outcome.confused}
				<p class="small muted">That is the capital of {outcome.confused.name}.</p>
			{/if}
			{@render facts({ dt: 'Country', dd: current.name })}
		{:else}
			<p class="verdict" class:wrong={!outcome.correct}>
				<span class="mark" aria-hidden="true">{outcome.correct ? '✓' : '✗'}</span>{current.name}
			</p>
			{#if outcome.typo}
				<p class="small muted">Spelling: {current.name}</p>
			{/if}
			{#if outcome.confused}
				<p class="confused small muted">
					<FlagImage
						src={outcome.confused.flag}
						ratio={outcome.confused.ratio}
						alt="Flag of {outcome.confused.name}"
						maxWidth={33}
						maxHeight={22}
					/>
					<span>This is {outcome.confused.name}'s flag.</span>
				</p>
			{/if}
			{@render facts(null)}
		{/if}
		<button class="next" class:always bind:this={button} onclick={onnext}><span>Next</span><kbd>⏎</kbd></button>
	{/if}
</div>

<style>
	.result {
		display: grid;
		gap: 8px;
		animation: rise 200ms var(--ease);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}

	.eyebrow {
		color: var(--muted);
		font-size: var(--t13);
	}

	.verdict {
		font-size: var(--t40);
		line-height: 1.05;
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.mark {
		font-size: 0.6em;
		margin-right: 8px;
		vertical-align: 0.12em;
	}

	.verdict.wrong .mark {
		color: var(--danger);
	}

	.small {
		font-size: var(--t13);
	}

	.confused {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.facts {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 32px;
	}

	.facts dt {
		color: var(--muted);
		font-size: var(--t13);
	}

	.facts dd {
		margin: 0;
		font-size: var(--t16);
		font-weight: 500;
	}

	.note {
		display: block;
		font-weight: 400;
		font-size: var(--t13);
		color: var(--muted);
		max-width: 36ch;
	}

	.next {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 6px 0 14px;
		margin-top: 4px;
		border-radius: 999px;
		border: 1px solid var(--fg);
		background: var(--fg);
		color: var(--bg);
		font-weight: 500;
		cursor: pointer;
	}

	.next kbd {
		background: transparent;
		color: inherit;
		border-color: color-mix(in srgb, var(--bg) 40%, transparent);
	}

	@media (max-width: 899px) {
		.verdict {
			font-size: var(--t24);
		}

		/* Enter on the keyboard moves on; the button is for picking modes
		   and study cards, where there is no keyboard up. */
		.next:not(.always):not(.study) {
			display: none;
		}
	}
</style>
