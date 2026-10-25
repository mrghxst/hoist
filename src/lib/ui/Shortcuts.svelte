<script lang="ts">
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	const keys: [string, string][] = [
		['Enter', 'Check the answer, then go to the next flag'],
		['Tab', 'Reveal the next letter (counts as a hint)'],
		['Esc', 'Give up and see the answer'],
		['1 – 4', 'Pick one of the "Which one?" choices'],
		['← → ↑ ↓', 'Turn the globe (when it has focus)'],
		['+ −', 'Zoom the globe'],
		['?', 'Show or hide these keys']
	];
</script>

<dialog bind:this={dialog} class="sheet glass" onclose={() => (open = false)} aria-labelledby="keys-title">
	<header>
		<h2 id="keys-title">Keyboard</h2>
		<button class="close" onclick={() => (open = false)} aria-label="Close">
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
				><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg
			>
		</button>
	</header>
	<dl>
		{#each keys as [k, what] (k)}
			<div>
				<dt><kbd>{k}</kbd></dt>
				<dd>{what}</dd>
			</div>
		{/each}
	</dl>
	<p class="muted">A round never needs the mouse.</p>
</dialog>

<style>
	.sheet {
		width: min(440px, calc(100vw - 32px));
		padding: 20px 24px 24px;
		color: var(--fg);
		background: var(--glass-strong);
	}

	.sheet[open] {
		animation: pop 180ms var(--ease);
	}

	.sheet::backdrop {
		background: var(--overlay);
		backdrop-filter: blur(2px);
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	h2 {
		font-size: var(--t16);
		letter-spacing: -0.01em;
	}

	.close {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.close:hover {
		color: var(--fg);
	}

	dl {
		margin: 0 0 12px;
		display: grid;
		gap: 8px;
	}

	dl div {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 12px;
		align-items: baseline;
	}

	dd {
		margin: 0;
	}

	p {
		font-size: var(--t13);
	}
</style>
