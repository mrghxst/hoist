/**
 * Which new flags to introduce, and in what order (PROMPT.md 7.2):
 * well-known first, five at a time, never two members of the same lookalike
 * group in the same batch.
 */
import type { GameCountry, LookalikeGroup } from '#lib/data/types.ts';
import { BATCH } from './queue.ts';

/**
 * Every country in introduction order: the hand-picked familiar flags in
 * their order, then easy to hard by the estimated difficulty, and within
 * that the bigger largest city first (a rough "how often you see it").
 */
export function introductionOrder(countries: readonly GameCountry[], familiar: readonly string[]): string[] {
	const rank = new Map(familiar.map((id, i) => [id, i]));
	return [...countries]
		.sort((a, b) => {
			const ra = rank.get(a.id) ?? Infinity;
			const rb = rank.get(b.id) ?? Infinity;
			if (ra !== rb) return ra - rb;
			if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
			return (b.largest.pop ?? 0) - (a.largest.pop ?? 0) || a.name.localeCompare(b.name);
		})
		.map((c) => c.id);
}

export function groupsOf(lookalikes: readonly LookalikeGroup[]): (id: string) => string[] {
	const map = new Map<string, string[]>();
	for (const g of lookalikes) for (const m of g.members) map.set(m, [...(map.get(m) ?? []), g.id]);
	return (id) => map.get(id) ?? [];
}

/**
 * Splits the next `count` unseen ids (in `order`) into batches of five, so
 * no batch holds two members of one lookalike group. A flag that would
 * clash waits for a later batch.
 */
export function batches(
	order: readonly string[],
	count: number,
	groups: (id: string) => readonly string[],
	size = BATCH
): string[][] {
	const queue = order.slice();
	const out: string[][] = [];
	let left = count;
	while (left > 0 && queue.length) {
		const batch: string[] = [];
		const taken = new Set<string>();
		for (let i = 0; i < queue.length && batch.length < Math.min(size, left); ) {
			const id = queue[i]!;
			const gs = groups(id);
			if (gs.some((g) => taken.has(g))) {
				i++;
				continue;
			}
			batch.push(id);
			for (const g of gs) taken.add(g);
			queue.splice(i, 1);
		}
		if (!batch.length) break;
		out.push(batch);
		left -= batch.length;
	}
	return out;
}
