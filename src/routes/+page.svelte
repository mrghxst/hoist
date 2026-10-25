<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { BRAND, TAGLINE } from '#lib/brand.ts';
	import GlobeView, { type Markers, type Target } from '#lib/ui/GlobeView.svelte';
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import { afterFirstPaint } from '#lib/ui/after-paint.ts';
	import type ShortcutsDialog from '#lib/ui/Shortcuts.svelte';
	import { loadGame } from '#lib/play/load.ts';
	import type { Game } from '#lib/play/game.svelte.ts';
	import { readSettings, writeSettings } from '#lib/store/storage.ts';
	import type { GameCountry, GameData } from '#lib/data/types.ts';

	let { data } = $props();

	const SCOPES: { id: string; label: string }[] = [
		{ id: 'all', label: 'Learn all 197' },
		{ id: 'europe', label: 'Europe' },
		{ id: 'africa', label: 'Africa' },
		{ id: 'asia', label: 'Asia' },
		{ id: 'americas', label: 'Americas' },
		{ id: 'oceania', label: 'Oceania' }
	];

	let game = $state<Game | null>(null);
	// The quiz engine and the keys dialog load after first paint (PROMPT.md 10).
	let engine: typeof import('#lib/play/game.svelte.ts') | undefined;
	let Shortcuts = $state<typeof ShortcutsDialog>();
	let loadError = $state(false);
	let pendingSubmit = false;
	let hydrated = $state(false);
	let showHelp = $state(false);
	let started = $state(false);
	let innerWidth = $state(1440);
	let kb = $state(0);
	let glow = $state(false);
	let shake = $state(false);
	let right = $state(0);
	let input = $state<HTMLInputElement>();
	let nextButton = $state<HTMLButtonElement>();

	let wide = $derived(innerWidth >= 900);
	let current = $derived(game?.current ?? null);
	let outcome = $derived(game?.outcome ?? null);
	let phase = $derived(game?.phase ?? 'ask');
	let answered = $derived(phase === 'done' && !!outcome && !!current);

	// The globe answers only after the player does (no answer leaks).
	let target = $derived<Target | null>(
		answered && current ? { id: current.id, centre: current.view.centre, zoom: current.view.zoom } : null
	);
	let markers = $derived<Markers | null>(
		answered && current
			? { capital: current.capital, largest: current.same ? undefined : current.largest }
			: null
	);
	let globeLabel = $derived(
		answered && current ? `Globe showing ${current.name} in ${continentName(current)}` : 'Globe, turning slowly'
	);
	let progress = $derived.by(() => {
		void phase;
		void current;
		return game ? game.deck.progress() : { done: 0, total: 10 };
	});

	function continentName(c: GameCountry) {
		if (c.continent !== 'Americas') return c.continent;
		return c.region === 'south-america' ? 'South America' : c.region === 'caribbean' ? 'the Caribbean' : 'North America';
	}

	function scopeIds(d: GameData, scope: string): string[] {
		const core = d.countries.filter((c) => c.pack === 'core');
		if (scope === 'all') return core.map((c) => c.id);
		if (scope === 'americas') return core.filter((c) => c.continent === 'Americas').map((c) => c.id);
		return core.filter((c) => c.region === scope).map((c) => c.id);
	}

	function labelFor(scope: string) {
		return scope === 'all' ? 'All flags' : (SCOPES.find((r) => r.id === scope)?.label ?? 'Practice');
	}

	onMount(() => {
		hydrated = true;
		afterFirstPaint()
			.then(() => Promise.all([loadGame(), import('#lib/play/game.svelte.ts')]))
			.then(([d, m]) => {
				engine = m;
				const { Game, ListDeck, ShuffleDeck } = m;
				const scope = readSettings().scope;
				// `?deck=CD,CG` plays a fixed list (used by the end-to-end tests).
				const forced = new URLSearchParams(location.search).get('deck');
				const g = new Game(d, new ListDeck('Starter round', d.starter));
				if (forced) g.start(new ListDeck('Practice', forced.split(',').filter((id) => d.countries.some((c) => c.id === id))));
				else if (typeof scope === 'string') g.start(new ShuffleDeck(labelFor(scope), scopeIds(d, scope)));
				else g.start();
				// Keep anything typed while the data was loading.
				if (input?.value) g.input = input.value;
				game = g;
				if (pendingSubmit) {
					pendingSubmit = false;
					submit();
				}
			})
			.catch(() => (loadError = true));

		// Keep the console above the on-screen keyboard (2.1).
		const vv = window.visualViewport;
		if (!vv) return;
		const onResize = () => {
			kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
		};
		vv.addEventListener('resize', onResize);
		vv.addEventListener('scroll', onResize);
		return () => {
			vv.removeEventListener('resize', onResize);
			vv.removeEventListener('scroll', onResize);
		};
	});

	function pickScope(scope: string) {
		if (!game || !engine) return;
		writeSettings({ scope });
		right = 0;
		game.start(new engine.ShuffleDeck(labelFor(scope), scopeIds(game.data, scope)));
		focusInput();
	}

	async function focusInput() {
		await tick();
		input?.focus({ preventScroll: true });
	}

	function afterAnswer() {
		if (!game) return;
		started = true;
		if (game.outcome?.correct) right++;
		if (game.outcome?.correct && game.streak > 0 && game.streak % 10 === 0) {
			glow = false;
			requestAnimationFrame(() => (glow = true));
		}
		// Keep focus in the field on phones so the keyboard stays up; Enter
		// on it moves on.
		if (wide) tick().then(() => nextButton?.focus({ preventScroll: true }));
	}

	function submit(e?: SubmitEvent) {
		e?.preventDefault();
		// Enter before the quiz data arrived: check once it has.
		if (!game) return void (pendingSubmit = true);
		if (game.phase === 'done') return next();
		const before = game.wrongCount;
		game.submit();
		if (game.wrongCount !== before) {
			shake = false;
			requestAnimationFrame(() => (shake = true));
		}
		if (game.outcome) afterAnswer();
	}

	function choose(id: string) {
		game?.choose(id);
		afterAnswer();
	}

	function next() {
		if (!game) return;
		game.advance();
		focusInput();
	}

	function onKeydown(e: KeyboardEvent) {
		if (!game || e.metaKey || e.ctrlKey || e.altKey) return;
		const typing = document.activeElement === input;
		if (e.key === '?') {
			e.preventDefault();
			showHelp = !showHelp;
			return;
		}
		if (showHelp) return;
		if (game.phase === 'choose' && /^[1-9]$/.test(e.key)) {
			const c = game.choices[Number(e.key) - 1];
			if (c) {
				e.preventDefault();
				choose(c.id);
			}
			return;
		}
		if (e.key === 'Escape' && game.phase !== 'done' && !game.finished) {
			e.preventDefault();
			game.giveUp();
			afterAnswer();
			return;
		}
		if (e.key === 'Tab' && typing && game.phase === 'ask' && !e.shiftKey) {
			e.preventDefault();
			game.hint();
			return;
		}
		if (e.key === 'Enter' && game.phase === 'done' && !typing && document.activeElement?.tagName !== 'BUTTON') {
			e.preventDefault();
			next();
		}
	}

	$effect(() => {
		if (showHelp && !Shortcuts) import('#lib/ui/Shortcuts.svelte').then((m) => (Shortcuts = m.default));
	});

	// The field is uncontrolled until the game exists, so hydration keeps what
	// was typed early; after that the game's text (hints, the next flag) wins.
	$effect(() => {
		if (game && input && input.value !== game.input) input.value = game.input;
	});

	let announce = $derived.by(() => {
		if (!answered || !current || !outcome) return '';
		const verdict = outcome.correct ? 'Right.' : outcome.gaveUp ? 'The answer:' : 'Not quite.';
		const big = current.same ? 'It is also the largest city.' : `Largest city ${current.largest.name}.`;
		return `${verdict} ${current.name}. Capital ${current.capital.name}. ${big}`;
	});
</script>

<svelte:head>
	<title>{BRAND} · {TAGLINE}</title>
	<meta
		name="description"
		content="See a flag, type the country, and a glass globe flies there. Spaced repetition, a daily challenge, no account."
	/>
</svelte:head>

<svelte:window bind:innerWidth onkeydown={onKeydown} />

<h1 class="visually-hidden">{BRAND}: name the flag</h1>

<div class="play" style:--kb="{kb}px">
	<div class="stage">
		<GlobeView
			label={globeLabel}
			autoRotate={!started}
			{target}
			{markers}
			offsetY={wide ? -90 : 0}
			view={{ lon: 15, lat: 25, zoom: wide ? 1.35 : 1.2 }}
		/>
	</div>

	<section class="console glass" aria-label="Quiz">
		<header class="meta">
			<span>
				{game?.deck.label ?? 'Starter round'}
				{#if progress.total}
					<span class="sep" aria-hidden="true">·</span>
					<span class="num">{Math.min(progress.done, progress.total)} of {progress.total}</span>
				{/if}
			</span>
			{#if game && game.streak > 1}
				<span class="streak" title="{game.streak} right in a row">
					<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"
						><path
							d="M8.5 1.5c.4 2.3-1.6 3.3-1.6 5.2 0 .9.6 1.6 1.4 1.6s1.3-.6 1.3-1.4c1.4 1 2.4 2.5 2.4 4.1A4 4 0 0 1 8 15a4 4 0 0 1-4-4c0-3.6 3.6-5 4.5-9.5z"
							fill="currentColor"
						/></svg
					>
					<span class="num">{game.streak}</span>
					<span class="visually-hidden">right in a row</span>
				</span>
			{/if}
		</header>

		<div class="body">
			<figure class="flag-card" class:glow onanimationend={() => (glow = false)}>
				{#if game?.finished}
					<p class="done-mark" aria-hidden="true">{right}/{progress.total ?? 10}</p>
				{:else if current}
					<FlagImage
						src={current.flag}
						ratio={current.ratio}
						alt={answered ? `Flag of ${current.name}` : 'Flag to name'}
						eager
					/>
				{:else}
					<FlagImage src={data.first.flag} ratio={data.first.ratio} alt="Flag to name" eager />
				{/if}
			</figure>

			<div class="answer">
				{#if game?.finished}
					<div class="finish">
						<h2>{right} of {progress.total} right.</h2>
						<p class="muted">Now learn all 197, or start with one region. You can change it any time in Practice.</p>
						<div class="chips">
							{#each SCOPES as s (s.id)}
								<button class="chip" class:primary={s.id === 'all'} onclick={() => pickScope(s.id)}>{s.label}</button>
							{/each}
						</div>
					</div>
				{:else}
					<!-- method="dialog": Enter before hydration does nothing instead of reloading. -->
						<form method="dialog" class="field" class:shake onsubmit={submit} onanimationend={() => (shake = false)} data-hydrated={hydrated}>
						<label class="visually-hidden" for="answer">Country name</label>
						<input
							id="answer"
							bind:this={input}
							oninput={(e) => {
								if (game) game.input = e.currentTarget.value;
							}}
							readonly={phase === 'done'}
							autocomplete="off"
							autocapitalize="words"
							spellcheck="false"
							enterkeyhint={phase === 'done' ? 'next' : 'go'}
							placeholder="Type the country"
							aria-describedby="keys"
							aria-busy={!game}
						/>
						<button class="enter" type="submit" aria-label={phase === 'done' ? 'Next flag' : 'Check'}>
							<kbd>⏎</kbd>
						</button>
					</form>

					{#if phase === 'choose' && game}
						<div class="which" role="group" aria-label="Which one?">
							<span class="muted">Which one?</span>
							<div class="chips">
								{#each game.choices as c, i (c.id)}
									<button class="chip" onclick={() => choose(c.id)}><kbd>{i + 1}</kbd>{c.name}</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if answered && current && outcome}
						<div class="result">
							<p class="verdict" class:wrong={!outcome.correct}>
								<span class="mark" aria-hidden="true">{outcome.correct ? '✓' : '✗'}</span>{current.name}
							</p>
							{#if outcome.typo}
								<p class="small muted">Spelling: {current.name}</p>
							{/if}
							{#if outcome.confused}
								<p class="confused small muted">
									<FlagImage src={outcome.confused.flag} ratio={outcome.confused.ratio} alt="Flag of {outcome.confused.name}" maxWidth={33} maxHeight={22} />
									<span>This is {outcome.confused.name}'s flag.</span>
								</p>
							{/if}
							<dl class="facts">
								<div>
									<dt>Capital</dt>
									<dd>
										{current.capital.name}
										{#if current.capital.note}<span class="note">{current.capital.note}</span>{/if}
									</dd>
								</div>
								<div>
									<dt>Largest city</dt>
									<dd>{current.same ? 'Also the capital' : current.largest.name}</dd>
								</div>
							</dl>
							<button class="next" bind:this={nextButton} onclick={next}><span>Next flag</span><kbd>⏎</kbd></button>
						</div>
					{:else if phase === 'ask'}
						<p class="keys" id="keys">
							<kbd>⏎</kbd> check<span class="sep" aria-hidden="true">·</span><kbd>Tab</kbd> a letter<span class="sep" aria-hidden="true">·</span><kbd>Esc</kbd> show me<span class="sep" aria-hidden="true">·</span><kbd>?</kbd> keys
						</p>
					{/if}
				{/if}
			</div>
		</div>
	</section>

	{#if loadError}
		<p class="error glass" role="alert">The flags did not load. Check the connection and reload the page.</p>
	{/if}

	<div class="visually-hidden" aria-live="polite">{announce}</div>
	{#if Shortcuts}<Shortcuts bind:open={showHelp} />{/if}
</div>

<style>
	.stage {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	.console {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		width: min(860px, calc(100vw - 32px));
		padding: 14px 20px 20px;
		border-radius: 20px;
		z-index: 2;
		display: grid;
		gap: 12px;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--muted);
		font-size: var(--t13);
		min-height: 20px;
	}

	.sep {
		margin: 0 6px;
		opacity: 0.6;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.streak {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--fg);
	}

	.body {
		display: grid;
		grid-template-columns: 312px 1fr;
		gap: 24px;
		align-items: start;
	}

	.flag-card {
		--flag-w: 288px;
		--flag-h: 184px;
		margin: 0;
		height: 208px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
	}

	.flag-card.glow {
		animation: glow 1400ms var(--ease);
	}

	@keyframes glow {
		30% {
			box-shadow:
				0 0 0 1px var(--accent),
				0 0 32px -4px var(--accent);
		}
	}

	.done-mark {
		font-size: 56px;
		font-weight: 600;
		letter-spacing: -0.04em;
	}

	.answer {
		display: grid;
		gap: 12px;
		align-content: start;
		min-height: 208px;
	}

	.field {
		position: relative;
	}

	.field.shake {
		animation: shake 300ms linear;
	}

	@keyframes shake {
		25%,
		75% {
			transform: translateX(-6px);
		}
		50%,
		100% {
			transform: translateX(6px);
		}
	}

	input {
		width: 100%;
		height: 52px;
		padding: 0 56px 0 16px;
		border-radius: 12px;
		border: 1px solid var(--border-strong);
		background: var(--bg);
		font-size: 20px;
		letter-spacing: -0.01em;
		outline: none;
		transition:
			border-color 150ms var(--ease),
			box-shadow 150ms var(--ease);
	}

	input::placeholder {
		color: var(--muted);
	}

	input:focus-visible,
	input:focus {
		border-color: var(--fg);
		box-shadow: 0 0 0 3px var(--overlay);
	}

	input[readonly] {
		color: var(--muted);
	}

	.enter {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 8px;
		background: none;
		cursor: pointer;
	}

	.keys {
		color: var(--muted);
		font-size: var(--t13);
	}

	.keys kbd {
		font-size: 11px;
		margin-right: 4px;
	}

	.which {
		display: grid;
		gap: 8px;
		font-size: var(--t13);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 14px 0 8px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--bg);
		cursor: pointer;
		font-size: var(--t14);
		transition: border-color 150ms var(--ease);
	}

	.chip:hover {
		border-color: var(--fg);
	}

	.finish .chip {
		padding: 0 16px;
	}

	.chip.primary {
		background: var(--fg);
		color: var(--bg);
		border-color: var(--fg);
	}

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

	.finish {
		display: grid;
		gap: 10px;
	}

	.error {
		position: fixed;
		top: calc(var(--bar-h) + 24px);
		left: 50%;
		transform: translateX(-50%);
		padding: 10px 16px;
		z-index: 3;
		font-size: var(--t13);
	}

	/* Phone: the globe fills the top 45%, the console rides above the
	   on-screen keyboard, and the result replaces the flag's caption. */
	@media (max-width: 899px) {
		.stage {
			inset: var(--bar-h) 0 auto 0;
			height: 45dvh;
		}

		.console {
			left: 8px;
			right: 8px;
			width: auto;
			transform: none;
			bottom: calc(8px + var(--kb, 0px) + env(safe-area-inset-bottom));
			padding: 10px 12px 12px;
			border-radius: 18px;
			gap: 8px;
		}

		.body {
			grid-template-columns: 1fr;
			gap: 10px;
		}

		.flag-card {
			--flag-w: 300px;
			--flag-h: 128px;
			height: 152px;
		}

		.answer {
			min-height: 0;
			gap: 10px;
		}

		.verdict {
			font-size: var(--t24);
		}

		.keys {
			display: none;
		}

		input {
			font-size: 18px;
			height: 48px;
		}

		.next {
			display: none;
		}
	}

	/* With the keyboard open there is little room: shrink the flag. */
	@media (max-width: 899px) and (max-height: 620px) {
		.flag-card {
			--flag-h: 76px;
			height: 96px;
		}
	}
</style>
