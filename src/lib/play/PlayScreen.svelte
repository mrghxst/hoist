<script lang="ts" module>
	import type { Deck, Game } from './game.svelte.ts';
	import type { PlayContext } from './engine.ts';

	export type Engine = typeof import('./engine.ts');

	export interface Finish {
		game: Game;
		ctx: PlayContext;
		engine: Engine;
		/** Play another deck in the same screen. */
		restart: (deck: Deck) => void;
	}
</script>

<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import GlobeView, { type Markers, type Target } from '#lib/ui/GlobeView.svelte';
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import { afterFirstPaint } from '#lib/ui/after-paint.ts';
	import type ShortcutsDialog from '#lib/ui/Shortcuts.svelte';
	import { loadGame } from './load.ts';
	import { clock } from '#lib/learn/daily.ts';
	import type { GameCountry } from '#lib/data/types.ts';

	interface Props {
		/** The first flag, prerendered (Play): shown before the engine loads. */
		first?: { flag: string; ratio: number } | null;
		/** Header and placeholder until the deck exists. */
		label?: string;
		placeholder?: string;
		/** Easy mode picks instead of typing: no text field before it loads. */
		picks?: boolean;
		/** The deck to start with, once the data and the engine are ready. */
		begin: (ctx: PlayContext, engine: Engine) => Deck;
		/** Shown in the answer area when the deck runs out. */
		finish: Snippet<[Finish]>;
		/** Shown in the flag card when the deck runs out (default: right / answered). */
		done?: Snippet<[Finish]>;
	}

	let { first = null, label = '', placeholder = 'Type the country', picks = false, begin, finish, done }: Props = $props();

	let game = $state<Game | null>(null);
	let ctx = $state<PlayContext | null>(null);
	// The quiz engine and the keys dialog load after first paint (PROMPT.md 10).
	let engine = $state.raw<Engine>();
	let Shortcuts = $state<typeof ShortcutsDialog>();
	let loadError = $state(false);
	let pendingSubmit = false;
	let hydrated = $state(false);
	let showHelp = $state(false);
	let started = $state(false);
	let persistent = $state(true);
	let innerWidth = $state(1440);
	let kb = $state(0);
	let glow = $state(false);
	let shake = $state(false);
	let input = $state<HTMLInputElement>();
	let nextButton = $state<HTMLButtonElement>();
	let now = $state(0);
	let autoNext: ReturnType<typeof setTimeout> | 0 = 0;

	let wide = $derived(innerWidth >= 900);
	let current = $derived(game?.current ?? null);
	let outcome = $derived(game?.outcome ?? null);
	let phase = $derived(game?.phase ?? 'ask');
	let ask = $derived(game?.ask ?? 'name');
	let show = $derived(game?.show ?? 'flag');
	let answered = $derived(phase === 'done' && !!outcome && !!current);
	let studying = $derived(phase === 'study' && !!current);
	let typing = $derived(ask !== 'pick');

	// The globe answers only after the player does (no answer leaks). A study
	// card shows everything; Reverse shows the country but no labels.
	let target = $derived<Target | null>(
		current && (answered || studying || (show === 'globe' && phase !== 'done'))
			? { id: current.id, centre: current.view.centre, zoom: current.view.zoom }
			: null
	);
	let markers = $derived<Markers | null>(
		current && (answered || studying) ? { capital: current.capital, largest: current.same ? undefined : current.largest } : null
	);
	let globeLabel = $derived(
		current && (answered || studying)
			? `Globe showing ${current.name} in ${continentName(current)}`
			: target
				? 'Globe with one country highlighted'
				: 'Globe, turning slowly'
	);
	let progress = $derived.by(() => {
		void phase;
		void current;
		return game ? game.deck.progress() : { done: 0, total: undefined };
	});
	/** The running time, for rounds against the clock. */
	let time = $derived.by(() => {
		void now;
		void phase;
		const e = game?.deck.elapsed?.();
		return e === undefined ? null : clock(e);
	});
	let tip = $derived.by(() => {
		if (!game || !current || !outcome) return undefined;
		if (game.deck.tips) return game.tip(current.id);
		return !outcome.correct && outcome.confused ? game.tip(current.id, outcome.confused.id) : undefined;
	});

	// Tick the clock while a flag waits for its answer.
	$effect(() => {
		if (!game?.deck.elapsed || game.finished) return;
		const t = setInterval(() => (now = performance.now()), 250);
		return () => clearInterval(t);
	});

	let fieldPlaceholder = $derived(
		!game ? placeholder : ask === 'capital' ? 'Type the capital' : 'Type the country'
	);

	const yieldTask = () => new Promise<void>((r) => setTimeout(r, 0));

	function continentName(c: GameCountry) {
		if (c.continent !== 'Americas') return c.continent;
		return c.region === 'south-america' ? 'South America' : c.region === 'caribbean' ? 'the Caribbean' : 'North America';
	}

	onMount(() => {
		hydrated = true;
		afterFirstPaint()
			.then(() => Promise.all([loadGame(), import('./engine.ts')]))
			.then(async ([d, m]) => {
				engine = m;
				// Set up in a few short tasks rather than one long one, so the
				// page stays responsive while the quiz gets ready.
				const c = m.context(d);
				persistent = c.learner.persistent;
				await yieldTask();
				const g = new m.Game(d, begin(c, m));
				await yieldTask();
				g.start();
				// Keep anything typed while the data was loading.
				if (input?.value && g.phase === 'ask') g.input = input.value;
				ctx = c;
				game = g;
				if (pendingSubmit) {
					pendingSubmit = false;
					submit();
				}
			})
			.catch((e) => {
				console.error(e);
				loadError = true;
			});

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

	function restart(deck: Deck) {
		if (!game) return;
		game.start(deck);
		focusInput();
	}

	async function focusInput() {
		await tick();
		if (game?.phase === 'study') nextButton?.focus({ preventScroll: true });
		else input?.focus({ preventScroll: true });
	}

	function afterAnswer() {
		if (!game?.outcome) return;
		started = true;
		if (ctx) engine?.feedback(game.outcome.correct, ctx.learner.settings);
		// Speed run: a right answer moves on by itself.
		if (game.deck.fast && game.outcome.correct) {
			clearTimeout(autoNext);
			autoNext = setTimeout(next, 450);
			return;
		}
		if (game.outcome.correct && game.streak > 0 && game.streak % 10 === 0) {
			glow = false;
			requestAnimationFrame(() => (glow = true));
		}
		// Keep focus in the field on phones so the keyboard stays up; Enter
		// on it moves on.
		if (wide || !typing) tick().then(() => nextButton?.focus({ preventScroll: true }));
	}

	function submit(e?: SubmitEvent) {
		e?.preventDefault();
		// Enter before the quiz data arrived: check once it has.
		if (!game) return void (pendingSubmit = true);
		if (game.phase === 'done' || game.phase === 'study') return next();
		const before = game.wrongCount;
		game.submit();
		if (game.wrongCount !== before) {
			shake = false;
			requestAnimationFrame(() => (shake = true));
		}
		afterAnswer();
	}

	function choose(id: string) {
		game?.choose(id);
		afterAnswer();
	}

	function pick(id: string) {
		game?.pick(id);
		afterAnswer();
	}

	function next() {
		if (!game) return;
		clearTimeout(autoNext);
		autoNext = 0;
		started = true;
		game.advance();
		focusInput();
	}

	function onKeydown(e: KeyboardEvent) {
		if (!game || e.metaKey || e.ctrlKey || e.altKey) return;
		const inField = document.activeElement === input;
		if (e.key === '?') {
			e.preventDefault();
			showHelp = !showHelp;
			return;
		}
		if (showHelp) return;
		if (/^[1-9]$/.test(e.key)) {
			const list = game.phase === 'choose' ? game.choices : game.phase === 'ask' && game.ask === 'pick' ? game.options : [];
			const c = list[Number(e.key) - 1];
			if (c) {
				e.preventDefault();
				if (game.phase === 'choose') choose(c.id);
				else pick(c.id);
			}
			return;
		}
		if (e.key === 'Escape' && (game.phase === 'ask' || game.phase === 'choose') && !game.finished) {
			e.preventDefault();
			game.giveUp();
			afterAnswer();
			return;
		}
		if (e.key === 'Tab' && inField && game.phase === 'ask' && !e.shiftKey) {
			e.preventDefault();
			game.hint();
			return;
		}
		if (e.key === 'Enter' && (game.phase === 'done' || game.phase === 'study') && !inField && document.activeElement?.tagName !== 'BUTTON') {
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
		if (!current) return '';
		const big = current.same ? 'It is also the largest city.' : `Largest city ${current.largest.name}.`;
		if (studying) return `New flag: ${current.name}. Capital ${current.capital.name}. ${big}`;
		if (!answered || !outcome) return '';
		const verdict = outcome.correct ? 'Right.' : outcome.gaveUp ? 'The answer:' : 'Not quite.';
		if (outcome.ask === 'capital') return `${verdict} ${current.capital.name} is the capital of ${current.name}.`;
		return `${verdict} ${current.name}. Capital ${current.capital.name}. ${big}`;
	});
</script>

<svelte:window bind:innerWidth onkeydown={onKeydown} />

<div class="play" style:--kb="{kb}px">
	<div class="stage">
		<GlobeView
			label={globeLabel}
			autoRotate={!started && !target}
			{target}
			{markers}
			offsetY={wide ? -90 : 0}
			view={{ lon: 15, lat: 25, zoom: wide ? 1.35 : 1.2 }}
		/>
	</div>

	<section class="console glass" aria-label="Quiz" aria-busy={!game}>
		<header class="meta">
			<span>
				{game?.deck.label ?? label}
				{#if progress.total}
					<span class="sep" aria-hidden="true">·</span>
					<span class="num">{Math.min(progress.done, progress.total)} of {progress.total}</span>
				{/if}
				{#if time}
					<span class="sep" aria-hidden="true">·</span>
					<span class="num" aria-label="Time">{time}</span>
				{/if}
			</span>
			{#if !persistent}
				<span class="quiet">Progress won't be saved in this browser.</span>
			{:else if game && game.streak > 1}
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
				{#if game?.finished && done && ctx && engine}
					{@render done({ game, ctx, engine, restart })}
				{:else if game?.finished}
					<p class="done-mark" aria-hidden="true">{game.right}/{game.answered}</p>
				{:else if current && show === 'name' && !answered && !studying}
					<p class="prompt-name">{current.name}</p>
				{:else if current && show === 'globe' && !answered && !studying}
					<p class="prompt-globe">
						<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"
							><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5" /><path
								d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							/></svg
						>
						<span>Which country is highlighted?</span>
					</p>
				{:else if current}
					<FlagImage
						src={current.flag}
						ratio={current.ratio}
						alt={answered || studying || ask === 'capital' ? `Flag of ${current.name}` : 'Flag to name'}
						eager
					/>
				{:else if first}
					<FlagImage src={first.flag} ratio={first.ratio} alt="Flag to name" eager />
				{/if}
			</figure>

			<div class="answer">
				{#if game?.finished && ctx && engine}
					<div class="finish">
						{@render finish({ game, ctx, engine, restart })}
					</div>
				{:else}
					{#if ask === 'capital' && current && !answered}
						<p class="asking">Capital of <strong>{current.name}</strong>?</p>
					{/if}

					{#if game ? typing && !studying : !picks}
						<!-- method="dialog": Enter before hydration does nothing instead of reloading. -->
						<form
							method="dialog"
							class="field"
							class:shake
							onsubmit={submit}
							onanimationend={() => (shake = false)}
							data-hydrated={hydrated}
						>
							<label class="visually-hidden" for="answer">{ask === 'capital' ? 'Capital' : 'Country name'}</label>
							<input
								id="answer"
								bind:this={input}
								oninput={(e) => {
									if (game) game.input = e.currentTarget.value;
								}}
								readonly={phase === 'done' || phase === 'study'}
								autocomplete="off"
								autocapitalize="words"
								spellcheck="false"
								enterkeyhint={phase === 'done' || phase === 'study' ? 'next' : 'go'}
								placeholder={fieldPlaceholder}
								aria-describedby="keys"
								aria-busy={!game}
							/>
							<button class="enter" type="submit" aria-label={phase === 'done' || phase === 'study' ? 'Next' : 'Check'}>
								<kbd>⏎</kbd>
							</button>
						</form>
					{/if}

					{#if phase === 'ask' && ask === 'pick' && game && engine}
						<engine.Pick options={game.options} {show} onpick={pick} />
					{/if}

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

					{#if (studying || (answered && outcome)) && current && engine}
						<engine.Reveal {current} outcome={studying ? null : outcome} always={!typing} {tip} onnext={next} bind:button={nextButton} />
					{:else if phase === 'ask' && typing}
						<p class="keys" id="keys">
							<kbd>⏎</kbd> check<span class="sep" aria-hidden="true">·</span><kbd>Tab</kbd> a letter<span
								class="sep"
								aria-hidden="true">·</span
							><kbd>Esc</kbd> show me<span class="sep" aria-hidden="true">·</span><kbd>?</kbd> keys
						</p>
					{:else if phase === 'ask'}
						<p class="keys" id="keys">
							<kbd>1</kbd>–<kbd>4</kbd> pick<span class="sep" aria-hidden="true">·</span><kbd>Esc</kbd> show
							me<span class="sep" aria-hidden="true">·</span><kbd>?</kbd> keys
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
		gap: 12px;
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

	.quiet {
		text-align: right;
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
		text-align: center;
		padding: 0 16px;
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

	.done-mark,
	.flag-card :global(.done-mark) {
		font-size: 56px;
		font-weight: 600;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}

	.prompt-name {
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	.prompt-globe {
		display: grid;
		justify-items: center;
		gap: 10px;
		color: var(--muted);
		font-size: var(--t14);
	}

	.prompt-globe svg {
		color: var(--fg);
	}

	.answer {
		display: grid;
		gap: 12px;
		align-content: start;
		min-height: 208px;
	}

	.asking {
		font-size: var(--t14);
		color: var(--muted);
	}

	.asking strong {
		color: var(--fg);
		font-weight: 600;
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

	.finish {
		display: grid;
		gap: 10px;
	}

	.finish :global(h2) {
		font-size: var(--t24);
		font-weight: 600;
		letter-spacing: -0.02em;
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

		.prompt-name {
			font-size: var(--t24);
		}

		.answer {
			min-height: 0;
			gap: 10px;
		}

		.keys {
			display: none;
		}

		input {
			font-size: 18px;
			height: 48px;
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
