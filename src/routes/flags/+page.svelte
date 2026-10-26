<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND, ORIGIN } from '#lib/brand.ts';
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import { afterFirstPaint } from '#lib/ui/after-paint.ts';
	import { loadGame } from '#lib/play/load.ts';
	import { REGIONS, scopeOf, title } from '#lib/play/scope.ts';
	import { normalize } from '#lib/match/normalize.ts';
	import type { Learner } from '#lib/learn/learner.ts';

	let { data } = $props();

	const FILTERS = [{ id: 'all', label: 'All 197' }, ...REGIONS.map((r) => ({ id: r, label: title(scopeOf(r).label) })), { id: 'territories', label: 'Territories' }];
	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'region', label: 'Region' },
		{ id: 'known', label: 'Progress' }
	] as const;
	const REGION_ORDER = new Map(REGIONS.map((r, i) => [r, i]));
	const LEVEL = ['Not started', 'Learning', 'Known', 'Mastered'];

	let query = $state('');
	let filter = $state('all');
	let sort = $state<(typeof SORTS)[number]['id']>('name');
	let learner = $state.raw<Learner | null>(null);
	let version = $state(0);

	onMount(() => {
		// How well each flag is known: from the progress store, after first paint.
		let off = () => {};
		afterFirstPaint()
			.then(() => Promise.all([loadGame(), import('#lib/play/engine.ts')]))
			.then(([d, m]) => {
				const l = m.context(d).learner;
				learner = l;
				off = l.subscribe(() => version++);
			})
			.catch(() => {});
		return () => off();
	});

	const level = (id: string) => {
		void version;
		return learner?.level('flag', id) ?? 0;
	};

	let shown = $derived.by(() => {
		const q = normalize(query);
		let list = data.flags.filter((f) => (filter === 'all' ? f.pack === 'core' : filter === 'territories' ? f.pack === 'territories' : f.pack === 'core' && f.region === filter));
		if (q) list = list.filter((f) => normalize(f.name).includes(q));
		if (sort === 'region') list = [...list].sort((a, b) => (REGION_ORDER.get(a.region) ?? 9) - (REGION_ORDER.get(b.region) ?? 9) || a.name.localeCompare(b.name, 'en'));
		if (sort === 'known') list = [...list].sort((a, b) => level(b.id) - level(a.id) || a.name.localeCompare(b.name, 'en'));
		return list;
	});
</script>

<svelte:head>
	<title>All flags · {BRAND}</title>
	<meta name="description" content="Every flag of the world's 197 countries, with capitals, largest cities and lookalikes." />
	<link rel="canonical" href="{ORIGIN}/flags" />
</svelte:head>

<section class="page">
	<header class="intro">
		<h1>All flags</h1>
		<p class="muted">The 193 UN members, Vatican City, Palestine, Kosovo and Taiwan, and some territories with their own flags.</p>
	</header>

	<div class="tools glass">
		<label class="search">
			<span class="visually-hidden">Search flags</span>
			<input type="search" placeholder="Search by name" value={query} oninput={(e) => (query = e.currentTarget.value)} autocomplete="off" spellcheck="false" />
		</label>
		<!-- Chips rather than a <select>: its runtime helper would join the shared chunk every page loads. -->
		<div class="sort chips" role="group" aria-label="Sort by">
			<span class="muted">Sort by</span>
			{#each SORTS as s (s.id)}
				<button class="chip" aria-pressed={sort === s.id} onclick={() => (sort = s.id)}>{s.label}</button>
			{/each}
		</div>
		<div class="chips region" role="group" aria-label="Region">
			{#each FILTERS as f (f.id)}
				<button class="chip" aria-pressed={filter === f.id} onclick={() => (filter = f.id)}>{f.label}</button>
			{/each}
		</div>
	</div>

	<p class="count muted" role="status">{shown.length} {shown.length === 1 ? 'flag' : 'flags'}</p>

	<ul class="grid">
		{#each shown as f (f.id)}
			<li>
				<a class="card glass" href="/flags/{f.slug}">
					<span class="frame"><FlagImage src={f.flag} ratio={f.ratio} alt="" maxWidth={132} maxHeight={84} /></span>
					<span class="name">{f.name}</span>
					{#if learner && level(f.id)}
						<span class="dot l{level(f.id)}" title={LEVEL[level(f.id)]}><span class="visually-hidden">{LEVEL[level(f.id)]}</span></span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
	{#if !shown.length}
		<p class="muted empty">No flag matches “{query}”.</p>
	{/if}
</section>

<style>
	.page {
		width: min(1120px, 100%);
		margin: 0 auto;
		padding: 24px 16px 64px;
		display: grid;
		gap: 16px;
	}

	.intro {
		text-align: center;
		display: grid;
		gap: 6px;
		margin-bottom: 8px;
	}

	h1 {
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.tools {
		position: sticky;
		top: calc(var(--bar-h) + 16px);
		z-index: 2;
		display: grid;
		grid-template-columns: 240px 1fr;
		align-items: center;
		gap: 12px 16px;
		padding: 12px 16px;
		border-radius: var(--r-glass);
	}

	.search input {
		width: 100%;
		height: 36px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--bg);
		font-size: var(--t14);
	}

	.chips {
		gap: 6px;
	}

	.chip {
		min-height: 32px;
		padding: 0 12px;
		font-size: var(--t13);
	}

	.chip[aria-pressed='true'] {
		background: var(--fg);
		color: var(--bg);
		border-color: var(--fg);
	}

	.sort {
		justify-content: flex-end;
		align-items: center;
	}

	.sort .muted {
		margin-right: 4px;
		font-size: var(--t13);
	}

	.region {
		grid-column: 1 / -1;
	}

	.count {
		font-size: var(--t13);
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
		gap: 12px;
	}

	.card {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 10px;
		padding: 16px 12px 12px;
		border-radius: 12px;
		color: var(--fg);
		text-decoration: none;
		text-align: center;
		transition:
			border-color 150ms var(--ease),
			transform 150ms var(--ease);
	}

	.card:hover {
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}

	.frame {
		height: 84px;
		display: grid;
		place-items: center;
	}

	.name {
		font-size: var(--t13);
		font-weight: 500;
		line-height: 1.3;
	}

	/* How well it is known: the mastery globe's tints. */
	.dot {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--fg) 25%, transparent);
	}

	.dot.l2 {
		background: color-mix(in srgb, var(--fg) 55%, transparent);
	}

	.dot.l3 {
		background: var(--accent);
	}

	.empty {
		text-align: center;
	}

	@media (max-width: 899px) {
		.tools {
			position: static;
			grid-template-columns: 1fr;
		}

		.sort {
			justify-content: flex-start;
		}
	}

	@media (max-width: 599px) {
		h1 {
			font-size: var(--t24);
		}

		/* One row that scrolls sideways rather than three rows of regions. */
		.region {
			flex-wrap: nowrap;
			overflow-x: auto;
			margin: 0 -16px;
			padding: 0 16px;
			scrollbar-width: none;
		}

		.region .chip {
			flex: none;
		}

		.grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}
	}
</style>
