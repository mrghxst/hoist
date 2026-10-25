/**
 * The practice modes (PROMPT.md 2.4) as decks for the game: what each shows,
 * what it asks, and which card it schedules.
 */
import type { Learner } from '#lib/learn/learner.ts';
import type { SessionQueue } from '#lib/learn/queue.ts';
import type { CardMode } from '#lib/learn/types.ts';
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

	constructor(label: string, queue: SessionQueue, learner: Learner, spec: ModeSpec, random = Math.random) {
		this.label = label;
		this.queue = queue;
		this.learner = learner;
		this.spec = spec;
		this.random = random;
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
