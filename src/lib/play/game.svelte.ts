/**
 * One round of the core loop (PROMPT.md 1.2): show a prompt, take an
 * answer, check it, reveal, move on. What comes next is up to a `Deck`
 * (the starter list, a spaced-repetition session, ...), and each prompt
 * says what to show and what to ask:
 *
 * - show the flag, ask the name (the main mode)
 * - show the flag and name, ask the capital (Capitals)
 * - show the country on the globe, ask the name (Reverse)
 * - show the flag or the name, pick from four (Easy mode)
 * - a study card: show everything, nothing to answer (Learn new)
 */
import { buildIndex, check, type NameIndex } from '#lib/match/match.ts';
import { capitalIndex, checkCapital } from '#lib/match/capital.ts';
import { hintText, hintWait, type HintRule } from '#lib/match/hint.ts';
import { rate, type Rating } from '#lib/learn/grade.ts';
import type { GameCountry, GameData } from '#lib/data/types.ts';

export type Phase = 'study' | 'ask' | 'choose' | 'done';
export type Show = 'flag' | 'globe' | 'name';
export type Ask = 'name' | 'capital' | 'pick';

export interface Prompt {
	id: string;
	study?: boolean;
	show?: Show;
	ask?: Ask;
}

export interface Outcome {
	id: string;
	correct: boolean;
	/** Accepted with a typo: show the spelling, rate Hard. */
	typo: boolean;
	hints: number;
	gaveUp: boolean;
	/** Picked from four rather than typed (Easy mode). */
	picked: boolean;
	/** The country the player named (or whose capital they named) instead. */
	confused?: GameCountry;
	/** What was typed, for the "you typed" line. */
	typed: string;
	ms: number;
	rating: Rating;
	ask: Ask;
}

/** Supplies the next prompt and hears about each answer. */
export interface Deck {
	readonly label: string;
	/** Position and total, when the round has a fixed length. */
	progress(): { done: number; total?: number };
	next(): Prompt | null;
	record(outcome: Outcome): void;
	/** Time on the clock so far, for rounds against it (daily, speed run). */
	elapsed?(): number;
	/** A right answer moves on by itself (speed run). */
	readonly fast?: boolean;
	/** Show the lookalike tip after each answer (lookalike drills). */
	readonly tips?: boolean;
	/** How many letters Tab may give (default `half`). */
	readonly hints?: HintRule;
	/** Points so far, for rounds that score them (the daily). */
	score?(): number;
	/**
	 * The first flag's clock starts at the first keystroke, not when it shows
	 * (Play's runs, like a typing test). `started` hears that keystroke.
	 */
	readonly startOnType?: boolean;
	started?(): void;
}

export class Game {
	readonly data: GameData;
	readonly byId: Map<string, GameCountry>;
	private index: NameIndex;
	private capitalsIndex?: NameIndex;
	private random: () => number;
	/** Reactive: the header shows its label, and Play swaps it from the bar. */
	deck = $state.raw() as Deck;

	current = $state<GameCountry | null>(null);
	show = $state<Show>('flag');
	ask = $state<Ask>('name');
	phase = $state<Phase>('ask');
	input = $state('');
	hints = $state(0);
	outcome = $state<Outcome | null>(null);
	/** "Which one?" chips for ambiguous names. */
	choices = $state<GameCountry[]>([]);
	/** The four options in Easy mode. */
	options = $state<GameCountry[]>([]);
	streak = $state(0);
	bestStreak = $state(0);
	right = $state(0);
	answered = $state(0);
	/** Bumps on every wrong answer, so the field can shake. */
	wrongCount = $state(0);
	finished = $state(false);
	private shownAt = 0;

	constructor(data: GameData, deck: Deck, extraNames?: Record<string, string[]>, random = Math.random) {
		this.data = data;
		this.byId = new Map(data.countries.map((c) => [c.id, c]));
		this.index = buildIndex(data.countries, data.ambiguous, extraNames);
		this.deck = deck;
		this.random = random;
	}

	/** Built on the first capital question: Play never needs it. */
	private get capitals(): NameIndex {
		return (this.capitalsIndex ??= capitalIndex(this.data.countries));
	}

	setExtraNames(extra?: Record<string, string[]>) {
		this.index = buildIndex(this.data.countries, this.data.ambiguous, extra);
	}

	/** Start (or restart) with a deck; shows its first prompt. */
	start(deck = this.deck) {
		this.deck = deck;
		this.finished = false;
		this.right = 0;
		this.answered = 0;
		this.advance();
	}

	advance() {
		const p = this.deck.next();
		this.outcome = null;
		this.choices = [];
		this.options = [];
		this.input = '';
		this.hints = 0;
		if (!p) {
			this.current = null;
			this.finished = true;
			this.phase = 'ask';
			return;
		}
		this.current = this.byId.get(p.id) ?? null;
		this.show = p.show ?? 'flag';
		this.ask = p.ask ?? 'name';
		this.phase = p.study ? 'study' : 'ask';
		if (!p.study && this.ask === 'pick' && this.current) this.options = this.pickOptions(this.current);
		this.shownAt = this.deck.startOnType && this.answered === 0 ? 0 : performance.now();
	}

	/** A keystroke: starts the clock of a round that waits for one. */
	touch() {
		if (this.shownAt || !this.current || this.phase !== 'ask') return;
		this.shownAt = performance.now();
		this.deck.started?.();
	}

	/**
	 * How to tell this flag from a lookalike (PROMPT.md 7.3): the tip of the
	 * group it shares with `other`, or with any group when `other` is unset.
	 */
	tip(id: string, other?: string): string | undefined {
		const g = this.data.lookalikes.find((g) => g.members.includes(id) && (!other || g.members.includes(other)));
		return g?.tip;
	}

	/** The text the hint letters come from. */
	get answerText(): string {
		const c = this.current;
		if (!c) return '';
		return this.ask === 'capital' ? c.capital.name : c.name;
	}

	get hintRule(): HintRule {
		return this.deck.hints ?? 'half';
	}

	/** Ms until Tab gives the next letter: 0 now, `null` not for this flag. */
	hintWait(now = performance.now()): number | null {
		if (!this.current || this.phase !== 'ask' || this.ask === 'pick') return null;
		return hintWait(this.hintRule, this.answerText, this.hints, this.shownAt ? now - this.shownAt : 0);
	}

	/** Tab: reveal the next letter, as far as the deck's rule allows. */
	hint() {
		if (this.hintWait() !== 0) return;
		this.touch();
		this.hints++;
		this.input = hintText(this.answerText, this.hints);
	}

	submit() {
		const c = this.current;
		if (!c || this.phase !== 'ask' || this.ask === 'pick') return;
		const r = this.ask === 'capital' ? checkCapital(this.input, c.id, this.capitals) : check(this.input, c.id, this.index);
		if (r.kind === 'empty') return;
		if (r.kind === 'ambiguous') {
			this.choices = r.ids.map((id) => this.byId.get(id)!).filter(Boolean);
			this.phase = 'choose';
			return;
		}
		if (r.kind === 'right') this.finish(true, r.typo);
		else this.finish(false, false, r.id ? this.byId.get(r.id) : undefined);
	}

	/** Pick one of the "Which one?" chips. */
	choose(id: string) {
		const c = this.current;
		if (!c || this.phase !== 'choose') return;
		if (id === c.id) this.finish(true, false);
		else this.finish(false, false, this.byId.get(id));
	}

	/** Pick one of the four options (Easy mode). */
	pick(id: string) {
		const c = this.current;
		if (!c || this.phase !== 'ask' || this.ask !== 'pick') return;
		this.finish(id === c.id, false, id === c.id ? undefined : this.byId.get(id), false, true);
	}

	/** Esc: show the answer, rated Again. */
	giveUp() {
		if (!this.current || this.phase === 'done' || this.phase === 'study') return;
		this.finish(false, false, undefined, true);
	}

	private finish(correct: boolean, typo: boolean, confused?: GameCountry, gaveUp = false, picked = false) {
		const c = this.current!;
		const ms = this.shownAt ? performance.now() - this.shownAt : 0;
		const outcome: Outcome = {
			id: c.id,
			correct,
			typo,
			hints: this.hints,
			gaveUp,
			picked,
			confused,
			typed: this.input.trim(),
			ms,
			rating: rate({ correct, typo, hints: this.hints, gaveUp, ms, picked }),
			ask: this.ask
		};
		this.outcome = outcome;
		this.phase = 'done';
		this.choices = [];
		this.answered++;
		if (correct) {
			this.right++;
			this.streak++;
			this.bestStreak = Math.max(this.bestStreak, this.streak);
		} else {
			this.streak = 0;
			this.wrongCount++;
		}
		this.deck.record(outcome);
	}

	/**
	 * Easy mode: the answer and three others from the same continent, none of
	 * them a lookalike of it (this mode is for beginners).
	 */
	private pickOptions(c: GameCountry): GameCountry[] {
		const near = new Set(this.data.lookalikes.filter((g) => g.members.includes(c.id)).flatMap((g) => g.members));
		const pool = this.data.countries.filter((x) => x.id !== c.id && x.pack === c.pack && !near.has(x.id));
		const same = pool.filter((x) => x.continent === c.continent);
		const others = this.shuffle(same.length >= 3 ? same : pool).slice(0, 3);
		return this.shuffle([c, ...others]);
	}

	private shuffle<T>(xs: T[]): T[] {
		const a = [...xs];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(this.random() * (i + 1));
			[a[i], a[j]] = [a[j]!, a[i]!];
		}
		return a;
	}
}

/** A fixed list of flags, in order (the starter round, the daily). */
export class ListDeck implements Deck {
	readonly label: string;
	private ids: string[];
	private i = 0;
	private onRecord?: (o: Outcome) => void;
	constructor(label: string, ids: string[], onRecord?: (o: Outcome) => void) {
		this.label = label;
		this.ids = ids;
		this.onRecord = onRecord;
	}
	progress() {
		return { done: Math.min(this.i, this.ids.length), total: this.ids.length };
	}
	next(): Prompt | null {
		const id = this.ids[this.i++];
		return id ? { id } : null;
	}
	record(o: Outcome) {
		this.onRecord?.(o);
	}
}
