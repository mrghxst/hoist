<script lang="ts">
	/**
	 * Play's mode bar (owner, M8), like a typing test's: runs of 10, 20, 30
	 * or a custom number of flags, or a speed run through all 197 or one
	 * region. It fades out once a run is under way and comes back at the end.
	 */
	import { MIN_RUN, RUN_LENGTHS } from './lengths.ts';
	import { FIRST_CHOICE, scopeOf, title } from './scope.ts';

	export type Kind = 'run' | 'speed';

	interface Props {
		kind: Kind;
		length: number;
		scope: string;
		/** Fewer flags than this cannot be asked for. */
		max: number;
		/** A run is under way: the bar steps aside. */
		hidden: boolean;
		/** The engine is not ready yet. */
		busy: boolean;
		onkind: (kind: Kind) => void;
		onlength: (n: number) => void;
		onscope: (scope: string) => void;
	}

	let { kind, length, scope, max, hidden, busy, onkind, onlength, onscope }: Props = $props();

	let custom = $derived(!(RUN_LENGTHS as readonly number[]).includes(length));
	let editing = $state(false);
	let field = $state<HTMLInputElement>();

	function openCustom() {
		editing = true;
		queueMicrotask(() => field?.select());
	}

	function applyCustom() {
		const n = Math.round(Number(field?.value));
		editing = false;
		if (Number.isFinite(n)) onlength(Math.min(max, Math.max(MIN_RUN, n)));
	}
</script>

<div class="runbar glass" class:hidden inert={hidden} aria-busy={busy}>
	<div class="group" role="group" aria-label="Mode">
		<button class="seg" aria-pressed={kind === 'run'} onclick={() => onkind('run')}>
			<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"
				><path d="M3.5 1.5v13M4.5 2.5h8l-2 3 2 3h-8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg
			>Flags
		</button>
		<button class="seg" aria-pressed={kind === 'speed'} onclick={() => onkind('speed')}>
			<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"
				><circle cx="8" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path
					d="M8 9V6M6.5 1.5h3"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
				/></svg
			>Speed run
		</button>
	</div>
	<span class="rule" aria-hidden="true"></span>
	{#if kind === 'run'}
		<div class="group" role="group" aria-label="Flags per run">
			{#each RUN_LENGTHS as n (n)}
				<button class="seg num" aria-pressed={length === n} onclick={() => onlength(n)}>{n}</button>
			{/each}
			{#if editing}
				<input
					bind:this={field}
					class="custom num"
					type="number"
					inputmode="numeric"
					min={MIN_RUN}
					{max}
					value={length}
					aria-label="Flags per run ({MIN_RUN} to {max})"
					onkeydown={(e) => {
						if (e.key === 'Enter') applyCustom();
						if (e.key === 'Escape') {
							e.stopPropagation();
							editing = false;
						}
					}}
					onblur={applyCustom}
				/>
			{:else}
				<button class="seg num" aria-pressed={custom} onclick={openCustom}>{custom ? length : 'custom'}</button>
			{/if}
		</div>
	{:else}
		<div class="group scroll" role="group" aria-label="Speed run through">
			{#each FIRST_CHOICE as id (id)}
				<button class="seg" aria-pressed={scope === id} onclick={() => onscope(id)}>{id === 'all' ? 'All 197' : title(scopeOf(id).label)}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.runbar {
		position: fixed;
		top: calc(var(--bar-h) + 20px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 3;
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: calc(100vw - 32px);
		padding: 4px;
		border-radius: 999px;
		transition:
			opacity 200ms var(--ease),
			transform 200ms var(--ease);
	}

	.runbar.hidden {
		opacity: 0;
		transform: translate(-50%, -6px);
		pointer-events: none;
	}

	.group {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}

	.scroll {
		overflow-x: auto;
		scrollbar-width: none;
	}

	.rule {
		width: 1px;
		height: 18px;
		background: var(--border-strong);
		flex: none;
	}

	.seg {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--muted);
		font-size: var(--t13);
		white-space: nowrap;
		cursor: pointer;
		transition:
			color 150ms var(--ease),
			background-color 150ms var(--ease);
	}

	.seg:hover {
		color: var(--fg);
	}

	.seg[aria-pressed='true'] {
		color: var(--fg);
		background: var(--overlay);
	}

	/* As the top bar's current page: a light wash in dark mode. */
	:global(:root[data-theme='dark']) .seg[aria-pressed='true'] {
		background: rgba(255, 255, 255, 0.1);
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .seg[aria-pressed='true'] {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.custom {
		width: 64px;
		height: 32px;
		padding: 0 10px;
		border-radius: 999px;
		border: 1px solid var(--fg);
		background: var(--bg);
		font-size: var(--t13);
		outline: none;
	}

	/* Phone: one row under the top bar, the speed-run regions scroll sideways. */
	@media (max-width: 599px) {
		.runbar {
			top: calc(var(--bar-h) + 8px);
			gap: 2px;
		}

		.seg {
			padding: 0 9px;
			height: 30px;
		}

		.seg svg {
			display: none;
		}
	}
</style>
