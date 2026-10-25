/**
 * Builds a practice session for one mode over a set of countries: due
 * cards, then today's new cards (PROMPT.md 3.2, 7.2). With nothing due and
 * no new cards left today, it offers the weakest cards instead, so "keep
 * going" always has something to show.
 */
import type { GameCountry, GameData } from '#lib/data/types.ts';
import { batches, groupsOf, introductionOrder } from './introduce.ts';
import type { Learner } from './learner.ts';
import { SessionQueue, type Similarity } from './queue.ts';
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

	/** Counts for the Practice cards and the play header. */
	summary(mode: CardMode, ids: readonly string[], now = Date.now()) {
		return {
			due: this.learner.due(mode, ids, now).length,
			unseen: this.learner.unseen(mode, ids).length,
			newToday: Math.min(this.learner.newLeftToday(mode, now), this.learner.unseen(mode, ids).length)
		};
	}
}
