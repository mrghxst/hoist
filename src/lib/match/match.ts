/**
 * Checking typed answers (PROMPT.md 5). Accept every answer a fair judge
 * would accept, reject every answer that names a different country.
 */
import { normalize } from './normalize.ts';

export interface Nameable {
	id: string;
	name: string;
	names: string[];
}

interface Entry {
	key: string;
	id: string;
}

export interface NameIndex {
	entries: Entry[];
	byKey: Map<string, Set<string>>;
	ambiguous: Map<string, string[]>;
	display: Map<string, string>;
}

export type MatchResult =
	| { kind: 'empty' }
	| { kind: 'right'; id: string; typo: boolean }
	| { kind: 'wrong'; id?: string }
	| { kind: 'ambiguous'; ids: string[] };

/**
 * Builds the lookup once. `extra` adds names per country, for example the
 * translations the player turned on in settings (5.2).
 */
export function buildIndex(
	countries: Nameable[],
	ambiguous: Record<string, string[]>,
	extra?: Record<string, string[]>
): NameIndex {
	const entries: Entry[] = [];
	const byKey = new Map<string, Set<string>>();
	const display = new Map<string, string>();
	const add = (id: string, name: string) => {
		const key = normalize(name);
		if (!key) return;
		let set = byKey.get(key);
		if (!set) byKey.set(key, (set = new Set()));
		if (set.has(id)) return;
		set.add(id);
		entries.push({ key, id });
	};
	for (const c of countries) {
		display.set(c.id, c.name);
		for (const n of c.names) add(c.id, n);
		for (const n of extra?.[c.id] ?? []) add(c.id, n);
	}
	const amb = new Map<string, string[]>();
	for (const [name, ids] of Object.entries(ambiguous)) amb.set(normalize(name), ids);
	return { entries, byKey, ambiguous: amb, display };
}

/** Typos allowed for a name of this many letters (5.3). */
export function allowance(length: number): number {
	if (length >= 9) return 2;
	if (length >= 5) return 1;
	return 0;
}

/**
 * Damerau–Levenshtein distance (optimal string alignment), stopping early
 * once it exceeds `max`.
 */
export function distance(a: string, b: string, max = Infinity): number {
	if (a === b) return 0;
	if (Math.abs(a.length - b.length) > max) return max + 1;
	const n = a.length;
	const m = b.length;
	let prev2 = new Array<number>(m + 1).fill(0);
	let prev = Array.from({ length: m + 1 }, (_, j) => j);
	let cur = new Array<number>(m + 1).fill(0);
	for (let i = 1; i <= n; i++) {
		cur[0] = i;
		let rowMin = i;
		for (let j = 1; j <= m; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
			cur[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		[prev2, prev, cur] = [prev, cur, prev2];
	}
	return prev[m]!;
}

export function check(answer: string, target: string, index: NameIndex): MatchResult {
	const n = normalize(answer);
	if (!n) return { kind: 'empty' };

	// The target's own display name always wins (typing "Guinea" for Guinea).
	const own = index.display.get(target);
	if (own && normalize(own) === n) return { kind: 'right', id: target, typo: false };

	const amb = index.ambiguous.get(n);
	if (amb) return amb.includes(target) ? { kind: 'ambiguous', ids: amb } : { kind: 'wrong' };

	const exact = index.byKey.get(n);
	if (exact) {
		if (exact.has(target)) return { kind: 'right', id: target, typo: false };
		return { kind: 'wrong', id: exact.values().next().value };
	}

	// Typos: the closest name decides. A tie with another country goes to the
	// other country, so near-misses between real names are never accepted.
	let bestTarget = Infinity;
	let bestOther = Infinity;
	let otherId: string | undefined;
	for (const e of index.entries) {
		const limit = allowance(e.key.length);
		if (limit === 0) continue;
		const d = distance(n, e.key, limit);
		if (d > limit) continue;
		if (e.id === target) bestTarget = Math.min(bestTarget, d);
		else if (d < bestOther) {
			bestOther = d;
			otherId = e.id;
		}
	}
	if (bestTarget < bestOther) return { kind: 'right', id: target, typo: true };
	if (otherId) return { kind: 'wrong', id: otherId };
	return { kind: 'wrong' };
}
