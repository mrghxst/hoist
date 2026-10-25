<script lang="ts">
	/**
	 * Easy mode's four options (PROMPT.md 2.4): names under a flag, or flags
	 * under a name. Number keys pick too. Loaded with the quiz engine.
	 */
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import type { GameCountry } from '#lib/data/types.ts';
	import type { Show } from './game.svelte.ts';

	let { options, show, onpick }: { options: GameCountry[]; show: Show; onpick: (id: string) => void } = $props();
</script>

{#if show === 'name'}
	<div class="options flags" role="group" aria-label="Pick the flag">
		{#each options as o, i (o.id)}
			<button class="option" onclick={() => onpick(o.id)} aria-label="Option {i + 1}">
				<kbd>{i + 1}</kbd>
				<FlagImage src={o.flag} ratio={o.ratio} alt="" maxWidth={120} maxHeight={64} />
			</button>
		{/each}
	</div>
{:else}
	<div class="options chips" role="group" aria-label="Pick the country">
		{#each options as o, i (o.id)}
			<button class="chip" onclick={() => onpick(o.id)}><kbd>{i + 1}</kbd>{o.name}</button>
		{/each}
	</div>
{/if}

<style>
	.options.chips .chip {
		min-height: 44px;
		font-size: var(--t16);
	}

	.options.flags {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.option {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		justify-items: center;
		gap: 8px;
		height: 92px;
		padding: 0 12px 0 8px;
		border-radius: 12px;
		border: 1px solid var(--border-strong);
		background: var(--bg);
		cursor: pointer;
		transition: border-color 150ms var(--ease);
	}

	.option:hover {
		border-color: var(--fg);
	}

	.option kbd {
		font-size: 11px;
	}

	@media (max-width: 899px) {
		.option {
			height: 72px;
		}
	}
</style>
