<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND } from '#lib/brand.ts';
	import { afterFirstPaint } from '#lib/ui/after-paint.ts';
	import GlobeView from '#lib/ui/GlobeView.svelte';
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import { loadGame } from '#lib/play/load.ts';
	import type { PlayContext } from '#lib/play/engine.ts';
	import type { Engine } from '#lib/play/PlayScreen.svelte';
	import { FIRST_CHOICE, scopeIds, scopeOf, title } from '#lib/play/scope.ts';
	import { addDays, clock, localDay } from '#lib/learn/daily.ts';
	import type { GameCountry } from '#lib/data/types.ts';

	// Same as EXPORT_NAME in transfer.ts, which loads with the engine.
	const FILE = 'hoist-progress.json';
	const WEEKS = 12;

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

	let ids = $derived(ctx ? scopeIds(ctx.data, 'all', ctx.learner.settings.territories) : []);

	let totals = $derived.by(() => {
		void version;
		if (!ctx) return null;
		const n = ctx.learner.counts('flag', ids);
		return {
			mastered: n[3],
			learning: n[1] + n[2],
			fresh: n[0],
			daily: ctx.learner.dailyStreak(),
			practice: ctx.learner.practiceStreak()
		};
	});

	/** Every country's level for the mastery globe (PROMPT.md 2.5). */
	let mastery = $derived.by(() => {
		void version;
		if (!ctx) return null;
		const l = ctx.learner;
		return new Map(ids.map((id) => [id, l.level('flag', id)] as const));
	});

	/** The last 12 weeks, Monday to Sunday, today in the last column. */
	let calendar = $derived.by(() => {
		void version;
		const today = localDay(Date.now());
		const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
		const start = addDays(today, -weekday - (WEEKS - 1) * 7);
		const days = ctx?.learner.progress.days ?? {};
		return Array.from({ length: WEEKS * 7 }, (_, i) => {
			const date = addDays(start, i);
			const n = date > today ? -1 : (days[date]?.n ?? 0);
			return { date, n, step: n < 0 ? -1 : n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3 };
		});
	});

	/** The five flags missed most often (PROMPT.md 2.5). */
	let hardest = $derived.by(() => {
		void version;
		if (!ctx) return [];
		const l = ctx.learner;
		const byId = new Map(ctx.data.countries.map((c) => [c.id, c]));
		return ids
			.map((id) => [id, l.card('flag', id)] as const)
			.filter(([, c]) => c && c.lapses > 0)
			.sort((a, b) => b[1]!.lapses - a[1]!.lapses || a[1]!.s - b[1]!.s)
			.slice(0, 5)
			.map(([id, c]) => ({ country: byId.get(id)!, lapses: c!.lapses }));
	});

	let bests = $derived.by(() => {
		void version;
		if (!ctx) return [];
		const best = ctx.learner.progress.best;
		return FIRST_CHOICE.filter((id) => best[id]).map((id) => ({ id, run: best[id]! }));
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

	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
	const named = (c: GameCountry) => c.name;
</script>

<svelte:head>
	<title>Progress · {BRAND}</title>
	<meta name="description" content="The mastery globe, your streaks, best speed runs and the flags you find hardest." />
</svelte:head>

<section class="page">
	<header class="intro">
		<h1>Progress</h1>
		<p class="muted">Kept in this browser only. No account, nothing sent anywhere.</p>
	</header>

	<div class="globe-card glass">
		<div class="globe">
			<GlobeView
				label="Mastery globe: {totals ? `${totals.mastered} mastered, ${totals.learning} learning, ${totals.fresh} not started` : 'loading'}"
				autoRotate
				controls={false}
				{mastery}
				view={{ lon: 15, lat: 30, zoom: 2.2 }}
			/>
		</div>
		<ul class="legend" aria-label="Legend">
			<li><span class="swatch s0"></span>Not started</li>
			<li><span class="swatch s1"></span>Learning</li>
			<li><span class="swatch s2"></span>Known</li>
			<li><span class="swatch s3"></span>Mastered</li>
		</ul>
	</div>

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
		<div>
			<dt>Daily streak</dt>
			<dd class="num">{totals?.daily ?? '–'}</dd>
		</div>
		<div>
			<dt>Practice streak</dt>
			<dd class="num">{totals?.practice ?? '–'}</dd>
		</div>
	</dl>
	{#if ctx && !ctx.learner.persistent}
		<p class="muted center">Progress won't be saved in this browser.</p>
	{/if}

	<h2>The last {WEEKS} weeks</h2>
	<div class="calendar glass">
		<ol class="days" aria-label="Answers per day, the last {WEEKS} weeks">
			{#each calendar as d (d.date)}
				<li
					class="day s{d.step}"
					title={d.n < 0 ? '' : `${plural(d.n, 'answer')} on ${d.date}`}
					aria-label={d.n < 0 ? undefined : `${d.date}: ${plural(d.n, 'answer')}`}
					aria-hidden={d.n < 0 ? 'true' : undefined}
				></li>
			{/each}
		</ol>
		<p class="scale muted" aria-hidden="true">
			Less <span class="day s0"></span><span class="day s1"></span><span class="day s2"></span><span class="day s3"></span> More
		</p>
	</div>

	<h2>Hardest for you</h2>
	{#if hardest.length}
		<ul class="hardest glass">
			{#each hardest as h (h.country.id)}
				<li>
					<FlagImage src={h.country.flag} ratio={h.country.ratio} alt="Flag of {named(h.country)}" maxWidth={48} maxHeight={32} />
					<span class="name">{h.country.name}</span>
					<span class="muted small">{plural(h.lapses, 'miss', 'misses')}</span>
					<a class="chip" href="/practice/drill?ids={h.country.id}">Drill</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted empty glass">{ctx ? 'No misses yet. Flags you get wrong will show up here.' : ''}</p>
	{/if}

	<h2>Best speed runs</h2>
	{#if bests.length}
		<ul class="bests glass">
			{#each bests as b (b.id)}
				<li>
					<span class="name">{b.id === 'all' ? 'All 197' : title(scopeOf(b.id).label)}</span>
					<span class="num">{b.run.right}/{b.run.total} · {clock(b.run.ms)}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted empty glass">{ctx ? 'No speed runs yet.' : ''} <a href="/practice/speed">Try one</a></p>
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
			<input bind:this={fileInput} class="visually-hidden" type="file" aria-label="Progress file to import" accept="application/json,.json" onchange={upload} tabindex="-1" />
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
		width: min(760px, 100%);
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

	h2 {
		margin-top: 20px;
		font-size: var(--t14);
		font-weight: 500;
		color: var(--muted);
	}

	.globe-card {
		border-radius: var(--r-glass);
		padding: 8px 8px 14px;
		display: grid;
		gap: 8px;
	}

	.globe {
		height: 400px;
	}

	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px 18px;
		font-size: var(--t13);
		color: var(--muted);
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		border: 1px solid var(--border-strong);
	}

	/* Same tints as the globe (src/lib/globe/palette.ts). */
	.swatch.s1 {
		background: color-mix(in srgb, var(--fg) 14%, transparent);
	}

	.swatch.s2 {
		background: color-mix(in srgb, var(--fg) 30%, transparent);
	}

	.swatch.s3 {
		background: color-mix(in srgb, var(--accent) 70%, transparent);
		border-color: transparent;
	}

	.totals {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 12px;
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
		font-size: 32px;
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.center {
		text-align: center;
	}

	.calendar {
		border-radius: var(--r-glass);
		padding: 18px 20px 12px;
		display: grid;
		gap: 10px;
		justify-items: center;
	}

	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-rows: repeat(7, 14px);
		grid-auto-flow: column;
		grid-auto-columns: 14px;
		gap: 4px;
	}

	.day {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		border: 1px solid var(--border);
	}

	.day.s-1 {
		visibility: hidden;
	}

	.day.s1 {
		background: color-mix(in srgb, var(--fg) 22%, transparent);
		border-color: transparent;
	}

	.day.s2 {
		background: color-mix(in srgb, var(--fg) 50%, transparent);
		border-color: transparent;
	}

	.day.s3 {
		background: var(--fg);
		border-color: transparent;
	}

	.scale {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--t13);
		justify-self: end;
	}

	.hardest,
	.bests {
		list-style: none;
		margin: 0;
		padding: 4px 20px;
		border-radius: var(--r-glass);
	}

	.hardest li,
	.bests li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 0;
	}

	.hardest li + li,
	.bests li + li {
		border-top: 1px solid var(--border);
	}

	.hardest .name,
	.bests .name {
		flex: 1;
		font-weight: 500;
	}

	.small {
		font-size: var(--t13);
	}

	.empty {
		padding: 16px 20px;
		border-radius: var(--r-glass);
		font-size: var(--t14);
	}

	.empty a {
		color: var(--fg);
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

	@media (max-width: 699px) {
		h1 {
			font-size: var(--t24);
		}

		.globe {
			height: 300px;
		}

		.totals {
			grid-template-columns: repeat(3, 1fr);
		}

		.totals dd {
			font-size: var(--t24);
		}

		.days {
			grid-template-rows: repeat(7, 10px);
			grid-auto-columns: 10px;
			gap: 3px;
		}

		.days .day {
			width: 10px;
			height: 10px;
		}

		.action {
			flex-wrap: wrap;
		}
	}
</style>
