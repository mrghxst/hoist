/**
 * Reading the stored object safely, and migrating old shapes (PROMPT.md 3.4).
 * Pure functions: no storage access here, so they are easy to test.
 */
import type { DayLog, Progress, Settings, StoredCard } from './types.ts';

export const SCHEMA_VERSION = 1;

export function emptyProgress(now = Date.now()): Progress {
	return { v: 1, settings: {}, cards: {}, days: {}, updated: now };
}

export type Migrated =
	| { ok: true; progress: Progress; from: number }
	/** Written by a newer Hoist: read it, but never overwrite it. */
	| { ok: false; reason: 'newer'; progress: Progress };

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

const CARD_KEY = /^(flag|capital|reverse):[A-Z]{2}$/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function cleanCard(x: unknown): StoredCard | null {
	if (!isObject(x)) return null;
	const { due, s, d, reps, lapses, state, step, sched, last } = x;
	if (![due, s, d, reps, lapses, step, sched, last].every(finite)) return null;
	if (state !== 0 && state !== 1 && state !== 2 && state !== 3) return null;
	if ((s as number) < 0 || (reps as number) < 0 || (lapses as number) < 0) return null;
	return {
		due: due as number,
		s: s as number,
		d: d as number,
		reps: reps as number,
		lapses: lapses as number,
		state,
		step: step as number,
		sched: sched as number,
		last: last as number
	};
}

function cleanDay(x: unknown): DayLog | null {
	if (!isObject(x)) return null;
	const { n, right, fresh } = x;
	if (![n, right].every(finite)) return null;
	const out: DayLog = { n: n as number, right: right as number, fresh: {} };
	if (isObject(fresh)) {
		for (const m of ['flag', 'capital', 'reverse'] as const) if (finite(fresh[m])) out.fresh[m] = fresh[m];
	}
	return out;
}

export function cleanSettings(x: unknown): Settings {
	if (!isObject(x)) return {};
	const out: Settings = {};
	if (x.theme === 'light' || x.theme === 'dark' || x.theme === 'system') out.theme = x.theme;
	if (typeof x.scope === 'string' && /^[a-z-]{2,20}$/.test(x.scope)) out.scope = x.scope;
	if (x.newPerDay === 5 || x.newPerDay === 10 || x.newPerDay === 20 || x.newPerDay === 30) out.newPerDay = x.newPerDay;
	if (typeof x.territories === 'boolean') out.territories = x.territories;
	if (Array.isArray(x.languages)) out.languages = x.languages.filter((l): l is string => typeof l === 'string' && /^[a-z]{3}$/.test(l));
	if (typeof x.sound === 'boolean') out.sound = x.sound;
	if (typeof x.haptics === 'boolean') out.haptics = x.haptics;
	return out;
}

function cleanMap<T>(x: unknown, key: RegExp, clean: (v: unknown) => T | null): Record<string, T> {
	const out: Record<string, T> = {};
	if (!isObject(x)) return out;
	for (const [k, v] of Object.entries(x)) {
		if (!key.test(k)) continue;
		const c = clean(v);
		if (c) out[k] = c;
	}
	return out;
}

/**
 * Turns whatever is stored into the current shape. Unknown or broken parts
 * are dropped, never thrown on: a bad entry must not lose the rest.
 *
 * - v0 (M0–M3): `{ settings }` only, no version field.
 * - v1: the current shape.
 */
export function migrate(raw: unknown, now = Date.now()): Migrated {
	if (!isObject(raw)) return { ok: true, progress: emptyProgress(now), from: 0 };
	const version = finite(raw.v) ? raw.v : 0;
	if (version > SCHEMA_VERSION) {
		return { ok: false, reason: 'newer', progress: v1From(raw, now) };
	}
	return { ok: true, progress: v1From(raw, now), from: version };
}

function v1From(raw: Record<string, unknown>, now: number): Progress {
	return {
		v: 1,
		settings: cleanSettings(raw.settings),
		cards: cleanMap(raw.cards, CARD_KEY, cleanCard),
		days: cleanMap(raw.days, DAY_KEY, cleanDay),
		updated: finite(raw.updated) ? raw.updated : now
	};
}
