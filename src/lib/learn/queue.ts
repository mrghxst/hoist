/**
 * The order of one practice session (PROMPT.md 3.2 and 7.2):
 *
 * 1. Due cards first, most overdue first, at most 50.
 * 2. Then new cards, five at a time: a study card for each (name, flight,
 *    capital), then the five quizzed in mixed order.
 * 3. Never the same flag twice in a row, and near-identical flags (same
 *    lookalike group, or same region and colours) rarely back to back,
 *    unless the session asks for that (the lookalike drill).
 * 4. A card answered Again comes back after 3 to 6 other cards, until it
 *    is answered right once.
 *
 * Pure and deterministic given `random`, so the rules are unit-tested.
 */
import { AGAIN, type Rating } from './grade.ts';

export const MAX_DUE = 50;
export const BATCH = 5;
const WINDOW = 4;

export interface Item {
	id: string;
	/** A study card: show the answer, nothing to type. */
	study: boolean;
}

export interface Similarity {
	region: string;
	colours: readonly string[];
	/** Lookalike groups this flag belongs to. */
	groups: readonly string[];
}

export interface QueueOptions {
	/** Due card ids, most overdue first. */
	due: string[];
	/** New card ids in batches (see `batches` in introduce.ts). */
	fresh?: string[][];
	similarity?: (id: string) => Similarity | undefined;
	/** Keep near-identical flags apart (default) or not (lookalike drill). */
	interleave?: boolean;
	random?: () => number;
	maxDue?: number;
}

export class SessionQueue {
	private pending: Item[] = [];
	private last: string | null = null;
	private answered = 0;
	private similarity?: (id: string) => Similarity | undefined;
	private interleave: boolean;
	private random: () => number;

	constructor(o: QueueOptions) {
		this.similarity = o.similarity;
		this.interleave = o.interleave ?? true;
		this.random = o.random ?? Math.random;
		for (const id of o.due.slice(0, o.maxDue ?? MAX_DUE)) this.pending.push({ id, study: false });
		for (const batch of o.fresh ?? []) {
			for (const id of batch) this.pending.push({ id, study: true });
			for (const id of this.shuffle([...batch])) this.pending.push({ id, study: false });
		}
	}

	/** Questions answered and the questions left (study cards do not count). */
	progress(): { done: number; total: number } {
		return { done: this.answered, total: this.answered + this.pending.filter((i) => !i.study).length };
	}

	get empty() {
		return this.pending.length === 0;
	}

	/** Questions still waiting (not counting one being shown). */
	remaining(): number {
		return this.pending.filter((i) => !i.study).length;
	}

	next(): Item | null {
		const at = this.pick();
		if (at < 0) {
			this.pending = [];
			return null;
		}
		const [item] = this.pending.splice(at, 1);
		this.last = item!.id;
		return item!;
	}

	/** Hear a quiz answer; an Again comes back after 3 to 6 other cards. */
	record(id: string, rating: Rating) {
		this.answered++;
		if (rating !== AGAIN) return;
		const others = this.pending.length;
		// Nothing else left to put in between: it stays due for next time.
		if (others === 0) return;
		const gap = 3 + Math.floor(this.random() * 4);
		this.pending.splice(Math.min(gap, others), 0, { id, study: false });
	}

	/** Index of the next item to show, or −1 when nothing can be shown. */
	private pick(): number {
		const n = Math.min(WINDOW, this.pending.length);
		let fallback = -1;
		for (let i = 0; i < n; i++) {
			const item = this.pending[i]!;
			if (item.id === this.last) continue;
			// Never quiz a flag before its study card has been shown.
			if (!item.study && this.pending.some((p, j) => j < i && p.study && p.id === item.id)) continue;
			if (fallback < 0) fallback = i;
			if (!this.interleave || !this.close(item.id)) return i;
		}
		if (fallback >= 0) return fallback;
		// Only the same flag is left in reach: look further along.
		const later = this.pending.findIndex((i) => i.id !== this.last);
		return later;
	}

	/** Near-identical to the flag just shown. */
	private close(id: string): boolean {
		if (!this.last || !this.similarity) return false;
		const a = this.similarity(id);
		const b = this.similarity(this.last);
		if (!a || !b) return false;
		if (a.groups.some((g) => b.groups.includes(g))) return true;
		if (a.region !== b.region) return false;
		const shared = a.colours.filter((c) => b.colours.includes(c)).length;
		return shared >= Math.min(2, a.colours.length, b.colours.length);
	}

	private shuffle<T>(xs: T[]): T[] {
		for (let i = xs.length - 1; i > 0; i--) {
			const j = Math.floor(this.random() * (i + 1));
			[xs[i], xs[j]] = [xs[j]!, xs[i]!];
		}
		return xs;
	}
}
