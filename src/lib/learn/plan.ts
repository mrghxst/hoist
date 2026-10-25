/**
 * Builds a practice session for one mode over a set of countries: due
 * cards, then today's new cards (PROMPT.md 3.2, 7.2). With nothing due and
 * no new cards left today, it offers the weakest cards instead, so "keep
 * going" always has something to show.
 */
import type { GameCountry, GameData } from '#lib/data/types.ts';
import { batches, groupsOf, introductionOrder } from './introduce.ts';
import type { Learner } from './learner.ts';
import { SessionQueue, type Item, type Similarity } from './queue.ts';
import { recall } from './scheduler.ts';
import type { CardMode } from './types.ts';

export const EXTRA = 20;

export interface Plan {
	queue: SessionQueue;
	due: number;
	fresh: number;
	/** Nothing was due: this is extra practice on the weakest cards. */
	extra: boolean;
}

export interface PlanOptions {
	mode: CardMode;
	/** The countries in scope (all 197, a region, ...). */
	ids: readonly string[];
	now?: number;
	/** Introduce new cards (Review does; Learn new only introduces). */
	due?: boolean;
	fresh?: boolean;
	/** Cap on new cards, under the daily limit (Learn new: 5). */
	freshMax?: number;
	/** Learn new is an explicit ask for new flags: the daily limit does not apply. */
	ignoreDailyLimit?: boolean;
	random?: () => number;
}

export class Planner {
	private order: string[];
	private groups: (id: string) => string[];
	private byId: Map<string, GameCountry>;
	readonly data: GameData;
	readonly learner: Learner;

	constructor(data: GameData, learner: Learner) {
		this.data = data;
		this.learner = learner;
		this.order = introductionOrder(data.countries, data.familiar);
		this.groups = groupsOf(data.lookalikes);
		this.byId = new Map(data.countries.map((c) => [c.id, c]));
	}

	similarity = (id: string): Similarity | undefined => {
		const c = this.byId.get(id);
		return c && { region: c.region, colours: c.colours, groups: this.groups(id) };
	};

	plan(o: PlanOptions): Plan {
		const now = o.now ?? Date.now();
		const inScope = new Set(o.ids);
		const due = o.due === false ? [] : this.learner.due(o.mode, o.ids, now);
		let freshIds: string[][] = [];
		if (o.fresh !== false) {
			const daily = o.ignoreDailyLimit ? Infinity : this.learner.newLeftToday(o.mode, now);
			const left = Math.min(daily, o.freshMax ?? Infinity);
			const unseen = this.learner.unseen(o.mode, this.order.filter((id) => inScope.has(id)));
			freshIds = batches(unseen, left, this.groups);
		}
		const fresh = freshIds.reduce((n, b) => n + b.length, 0);
		if (due.length || fresh) {
			return {
				queue: new SessionQueue({ due, fresh: freshIds, similarity: this.similarity, random: o.random }),
				due: Math.min(due.length, 50),
				fresh,
				extra: false
			};
		}
		const weakest = this.learner.weakest(o.mode, o.ids, now).slice(0, EXTRA);
		return {
			queue: new SessionQueue({ due: weakest, similarity: this.similarity, random: o.random }),
			due: 0,
			fresh: 0,
			extra: true
		};
	}

	/**
	 * A lookalike drill (PROMPT.md 2.4, 7.3): a few confusable groups, each
	 * group's flags back to back so they can be told apart. With `focus`, the
	 * groups of those flags (the "drill" buttons on Progress); otherwise the
	 * groups the player knows least. Unseen flags get a study card first.
	 */
	lookalikes(o: { focus?: readonly string[]; groups?: number; now?: number; random?: () => number } = {}): Plan {
		const now = o.now ?? Date.now();
		const rand = o.random ?? Math.random;
		const known = (id: string) => {
			const c = this.learner.card('flag', id);
			return c && c.reps > 0 ? recall(c, now) : 0;
		};
		let groups = this.data.lookalikes.filter((g) => g.members.every((id) => this.byId.get(id)?.pack === 'core'));
		if (o.focus?.length) {
			const focus = new Set(o.focus);
			groups = groups.filter((g) => g.members.some((id) => focus.has(id)));
		} else {
			// Weakest first: a group is as hard as its average member.
			const score = (g: { members: string[] }) => g.members.reduce((n, id) => n + known(id), 0) / g.members.length;
			groups = groups
				.map((g) => [g, score(g) + rand() * 0.05] as const)
				.sort((a, b) => a[1] - b[1])
				.map(([g]) => g)
				.slice(0, o.groups ?? 4);
		}
		const sequence: Item[] = [];
		const used = new Set<string>();
		for (const g of groups) {
			const members = g.members.filter((id) => !used.has(id));
			for (const id of members) used.add(id);
			for (const id of members) if (!this.learner.card('flag', id)?.reps) sequence.push({ id, study: true });
			for (const id of shuffle(members, rand)) sequence.push({ id, study: false });
		}
		// A flag in no group is drilled on its own.
		for (const id of o.focus ?? []) if (!used.has(id)) sequence.push({ id, study: false });
		return {
			queue: new SessionQueue({ due: [], sequence, interleave: false, random: rand }),
			due: sequence.filter((i) => !i.study).length,
			fresh: sequence.filter((i) => i.study).length,
			extra: false
		};
	}

	/** Counts for the Practice cards and the play header. */
	summary(mode: CardMode, ids: readonly string[], now = Date.now()) {
		return {
			due: this.learner.due(mode, ids, now).length,
			unseen: this.learner.unseen(mode, ids).length,
			newToday: Math.min(this.learner.newLeftToday(mode, now), this.learner.unseen(mode, ids).length)
		};
	}
}

function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}
