/**
 * One round of the core loop (PROMPT.md 1.2): show a flag, take a typed
 * answer, check it, reveal, move on. The order of flags comes from a
 * `Deck`, so the learning engine can plug in its own (M4).
 */
import { buildIndex, check, type NameIndex } from '#lib/match/match.ts';
import { hintText, maxHints } from '#lib/match/hint.ts';
import type { GameCountry, GameData } from '#lib/data/types.ts';

export type Phase = 'ask' | 'choose' | 'done';

export interface Outcome {
	id: string;
	correct: boolean;
	/** Accepted with a typo: show the spelling, rate Hard. */
	typo: boolean;
	hints: number;
	gaveUp: boolean;
	/** The country the player named instead, if any. */
	confused?: GameCountry;
	/** What was typed, for the "you typed" line. */
	typed: string;
	ms: number;
}

/** Supplies the next flag and hears about each answer. */
export interface Deck {
	readonly label: string;
	/** Position and total, when the round has a fixed length. */
	progress(): { done: number; total?: number };
	next(): string | null;
	record(outcome: Outcome): void;
}

export class Game {
	readonly data: GameData;
	readonly byId: Map<string, GameCountry>;
	private index: NameIndex;
	deck: Deck;

	current = $state<GameCountry | null>(null);
	phase = $state<Phase>('ask');
	input = $state('');
	hints = $state(0);
	outcome = $state<Outcome | null>(null);
	choices = $state<GameCountry[]>([]);
	streak = $state(0);
	bestStreak = $state(0);
	/** Bumps on every wrong answer, so the field can shake. */
	wrongCount = $state(0);
	finished = $state(false);
	private shownAt = 0;

	constructor(data: GameData, deck: Deck, extraNames?: Record<string, string[]>) {
		this.data = data;
		this.byId = new Map(data.countries.map((c) => [c.id, c]));
		this.index = buildIndex(data.countries, data.ambiguous, extraNames);
		this.deck = deck;
	}

	setExtraNames(extra?: Record<string, string[]>) {
		this.index = buildIndex(this.data.countries, this.data.ambiguous, extra);
	}

	/** Start (or restart) with a deck; shows its first flag. */
	start(deck = this.deck) {
		this.deck = deck;
		this.finished = false;
		this.advance();
	}

	advance() {
		const id = this.deck.next();
		this.outcome = null;
		this.choices = [];
		this.input = '';
		this.hints = 0;
		this.phase = 'ask';
		if (!id) {
			this.current = null;
			this.finished = true;
			return;
		}
		this.current = this.byId.get(id) ?? null;
		this.shownAt = performance.now();
	}

	/** Tab: reveal the next letter, up to half the name. */
	hint() {
		const c = this.current;
		if (!c || this.phase !== 'ask') return;
		if (this.hints >= maxHints(c.name)) return;
		this.hints++;
		this.input = hintText(c.name, this.hints);
	}

	submit() {
		const c = this.current;
		if (!c || this.phase !== 'ask') return;
		const r = check(this.input, c.id, this.index);
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

	/** Esc: show the answer, rated Again. */
	giveUp() {
		if (!this.current || this.phase === 'done') return;
		this.finish(false, false, undefined, true);
	}

	private finish(correct: boolean, typo: boolean, confused?: GameCountry, gaveUp = false) {
		const c = this.current!;
		const outcome: Outcome = {
			id: c.id,
			correct,
			typo,
			hints: this.hints,
			gaveUp,
			confused,
			typed: this.input.trim(),
			ms: performance.now() - this.shownAt
		};
		this.outcome = outcome;
		this.phase = 'done';
		this.choices = [];
		if (correct) {
			this.streak++;
			this.bestStreak = Math.max(this.bestStreak, this.streak);
		} else {
			this.streak = 0;
			this.wrongCount++;
		}
		this.deck.record(outcome);
	}
}

/** A fixed list of flags, in order (the starter round, the daily). */
export class ListDeck implements Deck {
	readonly label: string;
	private ids: string[];
	private i = 0;
	constructor(label: string, ids: string[]) {
		this.label = label;
		this.ids = ids;
	}
	progress() {
		return { done: this.i, total: this.ids.length };
	}
	next() {
		return this.ids[this.i++] ?? null;
	}
	record() {}
}

/** Endless shuffled practice over a set of countries, never twice in a row. */
export class ShuffleDeck implements Deck {
	readonly label: string;
	private ids: string[];
	private bag: string[] = [];
	private last: string | null = null;
	private count = 0;
	constructor(label: string, ids: string[]) {
		this.label = label;
		this.ids = ids;
	}
	progress() {
		return { done: this.count };
	}
	next() {
		if (!this.bag.length) {
			this.bag = [...this.ids];
			for (let i = this.bag.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[this.bag[i], this.bag[j]] = [this.bag[j]!, this.bag[i]!];
			}
			if (this.bag[this.bag.length - 1] === this.last && this.bag.length > 1) this.bag.unshift(this.bag.pop()!);
		}
		const id = this.bag.pop() ?? null;
		this.last = id;
		this.count++;
		return id;
	}
	record() {}
}
