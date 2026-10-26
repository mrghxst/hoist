/**
 * Export and import of progress as `hoist-progress.json` (PROMPT.md 3.4).
 * Import validates the file and merges by most recent review.
 */
import { cleanRuns, migrate } from './schema.ts';
import type { DayLog, Progress, SpeedResult } from './types.ts';

export const EXPORT_NAME = 'hoist-progress.json';

/** A speed run beats another with more right, or as many right in less time. */
export function better(a: SpeedResult, b: SpeedResult): boolean {
	return a.right > b.right || (a.right === b.right && a.ms < b.ms);
}

interface ExportFile {
	app: 'hoist';
	kind: 'progress';
	exported: string;
	progress: Progress;
}

export function exportProgress(p: Progress, now = Date.now()): string {
	const file: ExportFile = { app: 'hoist', kind: 'progress', exported: new Date(now).toISOString(), progress: p };
	return JSON.stringify(file);
}

export type Parsed = { ok: true; progress: Progress } | { ok: false; error: string };

export function parseImport(text: string): Parsed {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: 'This file is not valid JSON.' };
	}
	const file = raw as Partial<ExportFile> | null;
	if (!file || typeof file !== 'object' || file.app !== 'hoist' || file.kind !== 'progress') {
		return { ok: false, error: 'This is not a Hoist progress file.' };
	}
	const m = migrate(file.progress);
	if (!m.ok) return { ok: false, error: 'This file comes from a newer version of Hoist. Reload the page and try again.' };
	return { ok: true, progress: m.progress };
}

/**
 * Merges an imported file into the current progress: for each card the more
 * recent review wins; days keep the larger counts; a daily played in both
 * keeps the one here; the better speed run wins; runs from both are kept
 * (once each); settings already set here stay, missing ones come from the
 * file.
 */
export function merge(current: Progress, incoming: Progress): Progress {
	const cards = { ...current.cards };
	for (const [k, c] of Object.entries(incoming.cards)) {
		const mine = cards[k];
		if (!mine || c.last > mine.last) cards[k] = c;
	}
	const days: Record<string, DayLog> = { ...current.days };
	for (const [k, d] of Object.entries(incoming.days)) {
		const mine = days[k];
		if (!mine) {
			days[k] = d;
			continue;
		}
		const fresh: DayLog['fresh'] = { ...mine.fresh };
		for (const [m, n] of Object.entries(d.fresh) as [keyof DayLog['fresh'], number][]) fresh[m] = Math.max(fresh[m] ?? 0, n);
		days[k] = { n: Math.max(mine.n, d.n), right: Math.max(mine.right, d.right), fresh };
	}
	// One attempt per daily: the first one recorded stays.
	const daily = { ...incoming.daily, ...current.daily };
	const best = { ...current.best };
	for (const [k, b] of Object.entries(incoming.best)) {
		const mine = best[k];
		if (!mine || better(b, mine)) best[k] = b;
	}
	const seen = new Set(current.runs.map((r) => `${r.at}:${r.seed}`));
	const runs = cleanRuns([...current.runs, ...incoming.runs.filter((r) => !seen.has(`${r.at}:${r.seed}`))]);
	return {
		v: 3,
		settings: { ...incoming.settings, ...current.settings },
		cards,
		days,
		daily,
		best,
		runs,
		updated: Math.max(current.updated, incoming.updated)
	};
}
