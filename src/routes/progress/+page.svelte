<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND } from '#lib/brand.ts';
	import { afterFirstPaint } from '#lib/ui/after-paint.ts';
	import { loadGame } from '#lib/play/load.ts';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Engine } from '#lib/play/PlayScreen.svelte';
	import { scopeIds } from '#lib/play/scope.ts';

	// Same as EXPORT_NAME in transfer.ts, which loads with the engine.
	const FILE = 'hoist-progress.json';

	let ctx = $state<PlayContext | null>(null);
	let engine = $state.raw<Engine>();
	let version = $state(0);
	let message = $state('');
	let confirmReset = $state(false);
	let fileInput = $state<HTMLInputElement>();

	onMount(() => {
		let off = () => {};
		afterFirstPaint()
			.then(() => Promise.all([loadGame(), import('#lib/play/engine.ts')]))
			.then(([d, m]) => {
				const c = m.context(d);
				engine = m;
				ctx = c;
				off = c.learner.subscribe(() => version++);
			})
			.catch(() => (message = 'Progress could not be loaded. Reload the page to try again.'));
		return () => off();
	});

	let totals = $derived.by(() => {
		void version;
		if (!ctx) return null;
		const ids = scopeIds(ctx.data, 'all', ctx.learner.settings.territories);
		const n = ctx.learner.counts('flag', ids);
		return { mastered: n[3], learning: n[1] + n[2], fresh: n[0], total: ids.length };
	});

	function download() {
		if (!ctx || !engine) return;
		const blob = new Blob([engine.exportProgress(ctx.learner.progress)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = engine.EXPORT_NAME;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		message = `Saved ${engine.EXPORT_NAME}.`;
	}

	async function upload(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file || !ctx || !engine) return;
		const parsed = engine.parseImport(await file.text());
		if (!parsed.ok) {
			message = parsed.error;
			return;
		}
		const cards = Object.keys(parsed.progress.cards).length;
		ctx.learner.replace(engine.merge(ctx.learner.progress, parsed.progress));
		message = `Imported ${cards} card${cards === 1 ? '' : 's'}. Where both had a card, the more recent review was kept.`;
	}

	function reset() {
		if (!ctx || !engine) return;
		ctx.learner.replace({ ...engine.emptyProgress(), settings: ctx.learner.settings });
		confirmReset = false;
		message = 'Progress reset. Settings were kept.';
	}
</script>

<svelte:head>
	<title>Progress · {BRAND}</title>
	<meta name="description" content="How many flags you know, and your progress to take to another browser." />
</svelte:head>

<section class="page">
	<header class="intro">
		<h1>Progress</h1>
		<p class="muted">Kept in this browser only. No account, nothing sent anywhere.</p>
	</header>

	<dl class="totals glass" aria-busy={!totals}>
		<div>
			<dt>Mastered</dt>
			<dd class="num">{totals?.mastered ?? '–'}</dd>
		</div>
		<div>
			<dt>Learning</dt>
			<dd class="num">{totals?.learning ?? '–'}</dd>
		</div>
		<div>
			<dt>New</dt>
			<dd class="num">{totals?.fresh ?? '–'}</dd>
		</div>
	</dl>
	{#if ctx && !ctx.learner.persistent}
		<p class="muted center">Progress won't be saved in this browser.</p>
	{/if}

	<h2>Your data</h2>
	<div class="actions glass">
		<div class="action">
			<span>
				<span class="label">Export</span>
				<span class="muted hint">Download everything as <code>{FILE}</code>, to keep or move to another browser.</span>
			</span>
			<button class="chip" onclick={download} disabled={!ctx}>Export</button>
		</div>
		<div class="action">
			<span>
				<span class="label">Import</span>
				<span class="muted hint">Load a file you exported. It is merged in, keeping the most recent review of each flag.</span>
			</span>
			<button class="chip" onclick={() => fileInput?.click()} disabled={!ctx}>Import…</button>
			<input bind:this={fileInput} class="visually-hidden" type="file" accept="application/json,.json" onchange={upload} tabindex="-1" />
		</div>
		<div class="action">
			<span>
				<span class="label">Reset</span>
				<span class="muted hint">Forget every flag in this browser. Settings stay.</span>
			</span>
			{#if confirmReset}
				<span class="chips">
					<button class="chip danger" onclick={reset}>Delete progress</button>
					<button class="chip" onclick={() => (confirmReset = false)}>Cancel</button>
				</span>
			{:else}
				<button class="chip" onclick={() => (confirmReset = true)} disabled={!ctx}>Reset…</button>
			{/if}
		</div>
	</div>
	<p class="message" role="status">{message}</p>
</section>

<style>
	.page {
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 24px 16px 64px;
		display: grid;
		gap: 16px;
	}

	.intro {
		text-align: center;
		display: grid;
		gap: 6px;
		margin-bottom: 16px;
	}

	h1 {
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	h2 {
		margin-top: 24px;
		font-size: var(--t14);
		font-weight: 500;
		color: var(--muted);
	}

	.totals {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-radius: var(--r-glass);
		padding: 20px;
		text-align: center;
	}

	.totals dt {
		color: var(--muted);
		font-size: var(--t13);
	}

	.totals dd {
		margin: 0;
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.center {
		text-align: center;
	}

	.actions {
		display: grid;
		border-radius: var(--r-glass);
		padding: 4px 20px;
	}

	.action {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 14px 0;
	}

	.action + .action {
		border-top: 1px solid var(--border);
	}

	.label {
		font-weight: 500;
	}

	.hint {
		display: block;
		font-size: var(--t13);
		max-width: 52ch;
	}

	code {
		font-family: var(--mono);
		font-size: 0.92em;
	}

	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.chip.danger {
		border-color: var(--danger);
		color: var(--danger);
	}

	.message {
		min-height: 1.5em;
		text-align: center;
		font-size: var(--t14);
	}

	@media (max-width: 599px) {
		h1,
		.totals dd {
			font-size: var(--t24);
		}

		.action {
			flex-wrap: wrap;
		}
	}
</style>
