<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND } from '#lib/brand.ts';
	import { afterFirstPaint } from '#lib/ui/after-paint.ts';
	import { loadGame } from '#lib/play/load.ts';
	import type { PlayContext } from '#lib/play/engine.ts';
	import { PRACTICE, type PracticeMode } from '#lib/play/practice.ts';
	import { FIRST_CHOICE, scopeIds, scopeOf, title } from '#lib/play/scope.ts';
	import { readSettings, writeSettings } from '#lib/store/storage.ts';
	import type { Settings } from '#lib/learn/types.ts';

	const modes = PRACTICE.filter((m) => m.kind !== 'region');
	const regions = PRACTICE.filter((m) => m.kind === 'region');

	let ctx = $state<PlayContext | null>(null);
	let version = $state(0);
	let settings = $state<Settings>({});

	onMount(() => {
		// Only for the pressed states until the learner (which validates) loads.
		settings = readSettings() as Settings;
		let off = () => {};
		afterFirstPaint()
			.then(() => Promise.all([loadGame(), import('#lib/play/engine.ts')]))
			.then(([d, m]) => {
				const c = m.context(d);
				ctx = c;
				off = c.learner.subscribe(() => {
					settings = { ...c.learner.settings };
					version++;
				});
			})
			.catch(() => {});
		return () => off();
	});

	function set(patch: Partial<Settings>) {
		settings = { ...settings, ...patch };
		if (ctx) ctx.learner.setSettings(patch);
		else writeSettings(patch);
	}

	/** The number on each card. */
	function count(m: PracticeMode): string {
		void version;
		if (!ctx) return '';
		const l = ctx.learner;
		const ids = scopeIds(ctx.data, m.region ?? 'all', settings.territories);
		const due = l.due(m.card, ids).length;
		const unseen = l.unseen(m.card, ids).length;
		switch (m.kind) {
			case 'review':
				return `${due} due`;
			case 'learn':
				return unseen ? `${unseen} new` : 'All learned';
			case 'region':
				return `${ids.length - unseen} of ${ids.length}`;
			default:
				return due ? `${due} due` : unseen ? `${unseen} to learn` : 'All learned';
		}
	}
</script>

<svelte:head>
	<title>Practice · {BRAND}</title>
	<meta name="description" content="Pick what to drill: review, new flags, capitals, the reverse quiz, easy mode and regions." />
</svelte:head>

<section class="page">
	<header class="intro">
		<h1>Practice</h1>
		<p class="muted">Pick what to drill. Play on the home page mixes review and new flags for you.</p>
	</header>

	<ul class="grid modes" aria-label="Modes">
		{#each modes as m (m.slug)}
			<li>
				<a class="card glass" href="/practice/{m.slug}">
					<span class="row">
						<span class="name">{m.title}</span>
						<span class="count num">{count(m)}</span>
					</span>
					<span class="line muted">{m.line}</span>
				</a>
			</li>
		{/each}
	</ul>

	<h2>Regions</h2>
	<ul class="grid regions" aria-label="Regions">
		{#each regions as m (m.slug)}
			<li>
				<a class="card glass small" href="/practice/{m.slug}">
					<span class="name">{m.title}</span>
					<span class="count num">{count(m)}</span>
				</a>
			</li>
		{/each}
	</ul>

	<h2>Settings</h2>
	<div class="settings glass">
		<div class="setting">
			<span class="label" id="covers">Play covers</span>
			<div class="chips" role="group" aria-labelledby="covers">
				{#each FIRST_CHOICE as id (id)}
					<button class="chip" aria-pressed={(settings.scope ?? 'all') === id} onclick={() => set({ scope: id })}
						>{id === 'all' ? 'All 197' : title(scopeOf(id).label)}</button
					>
				{/each}
			</div>
		</div>
		<div class="setting">
			<span class="label" id="per-day">New flags per day</span>
			<div class="chips" role="group" aria-labelledby="per-day">
				{#each [5, 10, 20, 30] as const as n (n)}
					<button class="chip num" aria-pressed={(settings.newPerDay ?? 10) === n} onclick={() => set({ newPerDay: n })}>{n}</button>
				{/each}
			</div>
		</div>
		<label class="setting toggle">
			<span>
				<span class="label">Territories</span>
				<span class="muted hint">Also practise Greenland, Hong Kong, Puerto Rico and other places with their own flags.</span>
			</span>
			<input type="checkbox" checked={settings.territories ?? false} onchange={(e) => set({ territories: e.currentTarget.checked })} />
		</label>
	</div>
</section>

<style>
	.page {
		width: min(960px, 100%);
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

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}

	.modes {
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	.regions {
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	}

	.card {
		display: grid;
		gap: 6px;
		height: 100%;
		padding: 18px 20px;
		border-radius: var(--r-glass);
		color: var(--fg);
		text-decoration: none;
		transition:
			border-color 150ms var(--ease),
			transform 150ms var(--ease);
	}

	.card:hover {
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}

	.card.small {
		grid-template-columns: 1fr auto;
		align-items: center;
		padding: 14px 18px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}

	.name {
		font-size: var(--t16);
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.count {
		color: var(--muted);
		font-size: var(--t13);
		white-space: nowrap;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.line {
		font-size: var(--t14);
	}

	.settings {
		display: grid;
		border-radius: var(--r-glass);
		padding: 4px 20px;
	}

	.setting {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 14px 0;
	}

	.setting + .setting {
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

	.chip[aria-pressed='true'] {
		background: var(--fg);
		color: var(--bg);
		border-color: var(--fg);
	}

	.toggle {
		cursor: pointer;
	}

	.toggle input {
		width: 18px;
		height: 18px;
		accent-color: var(--fg);
	}

	@media (max-width: 599px) {
		h1 {
			font-size: var(--t24);
		}
	}
</style>
