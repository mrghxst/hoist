/**
 * The practice modes (PROMPT.md 2.4) as decks for the game: what each shows,
 * what it asks, and which card it schedules.
 */
import type { Learner } from '#lib/learn/learner.ts';
import type { SessionQueue } from '#lib/learn/queue.ts';
import { markOf } from '#lib/learn/daily.ts';
import type { CardMode, DailyResult, SpeedResult } from '#lib/learn/types.ts';
import type { Ask, Deck, Outcome, Prompt, Show } from './game.svelte.ts';

export interface ModeSpec {
	card: CardMode;
	/** `alternate`: Easy mode shows the flag (pick the name) or the name (pick the flag). */
	show: Show | 'alternate';
	ask: Ask;
}

export const MODES = {
	review: { card: 'flag', show: 'flag', ask: 'name' },
	capitals: { card: 'capital', show: 'flag', ask: 'capital' },
	reverse: { card: 'reverse', show: 'globe', ask: 'name' },
	easy: { card: 'flag', show: 'alternate', ask: 'pick' }
} as const satisfies Record<string, ModeSpec>;

/** A spaced-repetition session: every answer is scheduled and saved. */
export class LearnDeck implements Deck {
	readonly label: string;
	private queue: SessionQueue;
	private learner: Learner;
	private spec: ModeSpec;
	private random: () => number;
	private asked = 0;
	readonly tips: boolean;

	constructor(label: string, queue: SessionQueue, learner: Learner, spec: ModeSpec, o: { random?: () => number; tips?: boolean } = {}) {
		this.label = label;
		this.queue = queue;
		this.learner = learner;
		this.spec = spec;
		this.random = o.random ?? Math.random;
		this.tips = o.tips ?? false;
	}

	progress() {
		return { done: this.asked, total: this.asked + this.queue.remaining() };
	}

	next(): Prompt | null {
		const item = this.queue.next();
		if (!item) return null;
		if (!item.study) this.asked++;
		const show = this.spec.show === 'alternate' ? (this.random() < 0.5 ? 'flag' : 'name') : this.spec.show;
		return { id: item.id, study: item.study, show, ask: this.spec.ask };
	}

	record(o: Outcome) {
		this.learner.answer(this.spec.card, o.id, o.rating);
		this.queue.record(o.id, o.rating);
	}
}

/**
 * Counts only the time a flag waits for its answer, not the time spent
 * reading a result: pausing to read the facts does not cost a round.
 */
class Clock {
	private spent: number;
	private since: number | null = null;
	constructor(spent = 0) {
		this.spent = spent;
	}
	start() {
		this.since = performance.now();
	}
	stop(ms: number) {
		this.since = null;
		this.spent += ms;
	}
	get ms() {
		return this.spent + (this.since === null ? 0 : performance.now() - this.since);
	}
}

/**
 * The daily challenge (PROMPT.md 2.3). Saved after every answer, so a reload
 * carries on where it stopped: one attempt a day. Answers are scheduled like
 * any others, without using up the day's new flags.
 */
export class DailyDeck implements Deck {
	readonly label: string;
	private i: number;
	private result: DailyResult;
	private clock: Clock;
	private date: string;
	private ids: string[];
	private learner: Learner;

	constructor(date: string, ids: string[], learner: Learner, resume?: DailyResult) {
		this.label = 'Daily';
		this.date = date;
		this.ids = ids;
		this.learner = learner;
		this.result = resume ? { ...resume } : { right: 0, ms: 0, marks: '' };
		this.i = this.result.marks.length;
		this.clock = new Clock(this.result.ms);
	}

	progress() {
		return { done: Math.min(this.i, this.ids.length), total: this.ids.length };
	}

	next(): Prompt | null {
		const id = this.ids[this.i++];
		if (!id) return null;
		this.clock.start();
		return { id };
	}

	record(o: Outcome) {
		this.clock.stop(o.ms);
		this.learner.answer('flag', o.id, o.rating, Date.now(), true);
		this.result = {
			right: this.result.right + (o.correct ? 1 : 0),
			ms: Math.round(this.clock.ms),
			marks: this.result.marks + markOf(o)
		};
		this.learner.saveDaily(this.date, this.result);
	}

	elapsed() {
		return this.clock.ms;
	}
}

/**
 * A speed run (PROMPT.md 2.4): every flag in a scope, shuffled, against the
 * clock. A right answer moves on by itself. The best run per scope is kept.
 */
export class SpeedDeck implements Deck {
	readonly label: string;
	readonly fast = true;
	private ids: string[];
	private i = 0;
	private right = 0;
	private clock = new Clock();
	private learner: Learner;
	private scope: string;
	/** Set when the run is over. */
	result: SpeedResult | null = null;
	best = false;

	constructor(label: string, scope: string, ids: string[], learner: Learner, random = Math.random) {
		this.label = label;
		this.scope = scope;
		this.learner = learner;
		this.ids = [...ids];
		for (let i = this.ids.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[this.ids[i], this.ids[j]] = [this.ids[j]!, this.ids[i]!];
		}
	}

	progress() {
		return { done: Math.min(this.i, this.ids.length), total: this.ids.length };
	}

	next(): Prompt | null {
		const id = this.ids[this.i++];
		if (!id) return null;
		this.clock.start();
		return { id };
	}

	record(o: Outcome) {
		this.clock.stop(o.ms);
		if (o.correct) this.right++;
		this.learner.answer('flag', o.id, o.rating, Date.now(), true);
		if (this.i >= this.ids.length) {
			this.result = { right: this.right, total: this.ids.length, ms: Math.round(this.clock.ms), at: Date.now() };
			this.best = this.learner.saveSpeed(this.scope, this.result);
		}
	}

	elapsed() {
		return this.clock.ms;
	}
}
