/**
 * Play's runs (owner, M8): a set number of flags drawn at random from all
 * 197, no repeats, no letter hints, against the clock, like a typing test.
 *
 * Every run has a seed, and the seed fixes the order, so any run can be
 * played again by someone else: `/?n=20&seed=k3x9ab` is the same 20 flags
 * for everyone (a challenge link, for comparing with friends or a class).
 */
import { BRAND, DOMAIN, ORIGIN } from '#lib/brand.ts';
import { clock, squares } from '#lib/learn/daily.ts';
import type { RunResult } from '#lib/learn/types.ts';
import type { GameData } from '#lib/data/types.ts';

import { MIN_RUN } from './lengths.ts';

export { DEFAULT_RUN, MIN_RUN, RUN_LENGTHS } from './lengths.ts';

/** Every run draws from the 197 (never the territories), so runs compare. */
export function runPool(data: GameData): string[] {
	return data.countries.filter((c) => c.pack === 'core').map((c) => c.id);
}

/**
 * The order of a run: a permutation of `0 … size − 1` from a 32-bit seed
 * (mulberry32, then Fisher–Yates). Self-contained on purpose: the page
 * inlines its source to pick the first flag before any JavaScript loads
 * (`firstFlagScript` in `#lib/server/first-flag.ts`), and both must agree.
 */
export function runOrder(size: number, seed: number): number[] {
	let s = seed | 0;
	const rand = () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const a: number[] = [];
	for (let i = 0; i < size; i++) a.push(i);
	for (let i = size - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const x = a[i] as number;
		a[i] = a[j] as number;
		a[j] = x;
	}
	return a;
}

/** The flags of a run, in order. */
export function runIds(pool: readonly string[], seed: number, n: number): string[] {
	return runOrder(pool.length, seed)
		.slice(0, Math.min(n, pool.length))
		.map((i) => pool[i]!);
}

export const newSeed = () => (Math.random() * 4294967296) >>> 0;
export const seedText = (seed: number) => (seed >>> 0).toString(36);

/** A seed from the address, or null. */
export function parseSeed(text: string | null): number | null {
	if (!text || !/^[0-9a-z]{1,7}$/.test(text)) return null;
	const n = parseInt(text, 36);
	return n <= 0xffffffff ? n : null;
}

export function parseLength(text: string | null, max: number): number | null {
	const n = Number(text);
	return Number.isInteger(n) && n >= MIN_RUN && n <= max ? n : null;
}

/** The address that plays the same run. */
export const runPath = (n: number, seed: number) => `/?n=${n}&seed=${seedText(seed)}`;

/** Right share, 0 to 100. */
export const accuracy = (r: { right: number; n: number }) => (r.n ? Math.round((r.right / r.n) * 100) : 0);

/** A run beats another with more right, or as many right in less time. */
export const betterRun = (a: RunResult, b: RunResult) => a.right > b.right || (a.right === b.right && a.ms < b.ms);

/**
 * The text to share:
 *
 *     Hoist · 20 flags · 18/20 (90%) · 1:23
 *     🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩
 *     Same flags: https://hoist.itsanon.com/?n=20&seed=k3x9ab
 */
export function runShareText(r: RunResult): string {
	return [
		`${BRAND} · ${r.n} flags · ${r.right}/${r.n} (${accuracy(r)}%) · ${clock(r.ms)}`,
		...(r.n <= 30 ? [squares(r.marks)] : []),
		`Same flags: ${ORIGIN}${runPath(r.n, r.seed)}`
	].join('\n');
}

/** A speed run's text (all of a scope, so no link is needed to compare). */
export const speedShareText = (label: string, r: { right: number; total: number; ms: number }) =>
	`${BRAND} speed run · ${label} · ${r.right}/${r.total} · ${clock(r.ms)}\n${DOMAIN}`;

declare global {
	interface Window {
		/** Set by the inline script on Play: the seed of the run on screen. */
		__hoistRun?: { seed: number };
	}
}
