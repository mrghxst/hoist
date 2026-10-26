/**
 * The daily challenge (PROMPT.md 2.3): the same ten flags for everyone on a
 * UTC date, a mix of easy, medium and hard, chosen by a seed from the date.
 *
 * "Never repeating within 30 days" cannot hold: 30 days of ten flags is 300,
 * and there are 197. With two easy, three medium and five hard a day (40, 54
 * and 103 flags in those groups) the longest gap that can always be kept is
 * 17 days; this keeps 14, leaving some choice every day (docs/decisions.md).
 *
 * Each day's set depends on the days before it, so they are computed in
 * order from a fixed start date. Same date and same data, same ten flags,
 * in every browser.
 */
import { BRAND, DOMAIN } from '#lib/brand.ts';
import type { DailyResult, DayLog } from './types.ts';

export const DAILY_SIZE = 10;
export const NO_REPEAT_DAYS = 14;
/** Flags per difficulty (1 easy, 2 medium, 3 hard). */
export const MIX: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 5 };
/** The order of difficulties within a round: it starts easy, ends hard. */
const ORDER: (1 | 2 | 3)[] = [1, 2, 3, 1, 2, 3, 2, 3, 3, 3];
/** The first daily. Days before it are computed without history. */
export const EPOCH = '2026-10-01';

const DAY = 86_400_000;

export interface Candidate {
	id: string;
	difficulty: 1 | 2 | 3;
}

/** Local calendar date, `YYYY-MM-DD`: "today" is the player's own day. */
export function localDay(now: number): string {
	const d = new Date(now);
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `YYYY-MM-DD` for the UTC day of `now`. */
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
	return utcDay(Date.parse(`${date}T00:00:00Z`) + n * DAY);
}

export function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** A small, fast, seeded random generator (mulberry32). */
function random(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A 32-bit hash of a string (FNV-1a). */
function hash(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function pickDay(date: string, pool: readonly Candidate[], recent: Set<string>): string[] {
	const rand = random(hash(`hoist-daily:${date}`));
	const picked: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
	for (const tier of [1, 2, 3] as const) {
		const ids = pool
			.filter((c) => c.difficulty === tier)
			.map((c) => c.id)
			.sort();
		const fresh = ids.filter((id) => !recent.has(id));
		// Shuffle the allowed ones; fall back to recent ones only if the data
		// ever gets too small for the gap (it does not with 197 flags).
		const order = [...shuffle(fresh, rand), ...shuffle(ids.filter((id) => recent.has(id)), rand)];
		picked[tier] = order.slice(0, MIX[tier]);
	}
	return ORDER.map((tier) => picked[tier].shift()!).filter(Boolean);
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
	for (let i = xs.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[xs[i], xs[j]] = [xs[j]!, xs[i]!];
	}
	return xs;
}

const cache = new WeakMap<readonly Candidate[], Map<string, string[]>>();

/** The ten flags of the daily for a UTC date (`YYYY-MM-DD`). */
export function dailySet(date: string, pool: readonly Candidate[]): string[] {
	let days = cache.get(pool);
	if (!days) cache.set(pool, (days = new Map()));
	const hit = days.get(date);
	if (hit) return hit;
	if (date < EPOCH) {
		const set = pickDay(date, pool, new Set());
		days.set(date, set);
		return set;
	}
	// Walk forward from the epoch (or the last day computed), keeping the
	// flags of the last 14 days out of each new day.
	let d = EPOCH;
	for (let back = 1; back <= daysBetween(EPOCH, date); back++) {
		const earlier = addDays(date, -back);
		if (days.has(earlier)) {
			d = addDays(earlier, 1);
			break;
		}
	}
	for (; d <= date; d = addDays(d, 1)) {
		if (days.has(d)) continue;
		const recent = new Set<string>();
		for (let k = 1; k <= NO_REPEAT_DAYS; k++) {
			const prev = addDays(d, -k);
			if (prev < EPOCH) break;
			for (const id of days.get(prev) ?? []) recent.add(id);
		}
		days.set(d, pickDay(d, pool, recent));
	}
	return days.get(date)!;
}

/**
 * G right, Y right with the one letter the daily allows, R wrong or given
 * up. A typo that was accepted is right (owner, M8).
 */
export function markOf(o: { correct: boolean; hints: number }): 'G' | 'Y' | 'R' {
	if (!o.correct) return 'R';
	return o.hints > 0 ? 'Y' : 'G';
}

/** Points per flag (owner, M8): 100 right, 25 right with a letter. */
export const POINTS: Record<string, number> = { G: 100, Y: 25, R: 0 };
export const MAX_POINTS = DAILY_SIZE * POINTS.G!;

export const pointsOf = (marks: string) => [...marks].reduce((n, m) => n + (POINTS[m] ?? 0), 0);

/** 41 s → "0:41", 75 min → "1:15:00". */
export function clock(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const SQUARE = { G: '🟩', Y: '🟨', R: '🟥' } as const;

/**
 * The text to share (PROMPT.md 2.3):
 *
 *     Hoist Daily 2026-10-25 · 725/1000 · 0:41
 *     🟩🟩🟩🟥🟩🟩🟨🟩🟥🟩
 *     hoist.itsanon.com/daily
 */
export function shareText(date: string, r: DailyResult): string {
	return `${BRAND} Daily ${date} · ${pointsOf(r.marks)}/${MAX_POINTS} · ${clock(r.ms)}\n${squares(r.marks)}\n${DOMAIN}/daily`;
}

/** 🟩🟥🟨, one per flag. */
export const squares = (marks: string) => [...marks].map((m) => SQUARE[m as keyof typeof SQUARE]).join('');

/**
 * Days in a row up to `today` (or up to yesterday, while today is still to
 * play) that have an entry. Works for both daily results (UTC days) and
 * practice days (local days).
 */
export function streak(days: Record<string, DailyResult | DayLog>, today: string): number {
	let d = days[today] ? today : addDays(today, -1);
	let n = 0;
	while (days[d]) {
		n++;
		d = addDays(d, -1);
	}
	return n;
}
