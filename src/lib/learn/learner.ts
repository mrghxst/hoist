/**
 * One player's progress: cards, days and settings, with the few operations
 * the app needs. Plain TypeScript (no runes) so it is unit-tested directly;
 * the UI listens with `subscribe`.
 */
import { writeSettings } from '#lib/store/storage.ts';
import { isRight, type Rating } from './grade.ts';
import { level, recall, review, type Level } from './scheduler.ts';
import type { ProgressStore } from './store.ts';
import { localDay, streak, utcDay } from './daily.ts';
import { better } from './transfer.ts';
import { MAX_RUNS } from './schema.ts';
import type { CardKey, CardMode, DailyResult, DayLog, Progress, RunResult, Settings, SpeedResult, StoredCard } from './types.ts';

export const DEFAULT_NEW_PER_DAY = 10;

export { localDay };

export const keyOf = (mode: CardMode, id: string) => `${mode}:${id}` as CardKey;

export class Learner {
	progress: Progress;
	readonly store: ProgressStore;
	private listeners = new Set<() => void>();
	/** Settings go through `writeSettings` unless a test swaps this out. */
	saveSettings: (patch: Partial<Settings>) => void = (patch) => void writeSettings(patch);

	constructor(store: ProgressStore) {
		this.store = store;
		this.progress = store.load();
	}

	get persistent() {
		return this.store.persistent;
	}

	get settings(): Settings {
		return this.progress.settings;
	}

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private changed() {
		for (const fn of this.listeners) fn();
	}

	/** Reload from the store (another tab saved, or after an import). */
	reload() {
		this.progress = this.store.load();
		this.changed();
	}

	replace(progress: Progress) {
		this.progress = progress;
		this.store.save(progress);
		this.saveSettings(progress.settings);
		this.changed();
	}

	setSettings(patch: Partial<Settings>) {
		this.progress.settings = { ...this.progress.settings, ...patch };
		this.saveSettings(patch);
		this.changed();
	}

	card(mode: CardMode, id: string): StoredCard | undefined {
		return this.progress.cards[keyOf(mode, id)];
	}

	level(mode: CardMode, id: string): Level {
		return level(this.card(mode, id));
	}

	/**
	 * Schedules one answer and saves. Returns the updated card. A `warmUp`
	 * answer (the first-visit starter round of well-known flags) is scheduled
	 * but does not use up the day's new cards.
	 */
	answer(mode: CardMode, id: string, rating: Rating, now = Date.now(), warmUp = false): StoredCard {
		const key = keyOf(mode, id);
		const before = this.progress.cards[key];
		const after = review(before, rating, now);
		this.progress.cards[key] = after;
		const day = this.day(now);
		day.n++;
		if (isRight(rating)) day.right++;
		if (!warmUp && (!before || before.reps === 0)) day.fresh[mode] = (day.fresh[mode] ?? 0) + 1;
		this.progress.updated = now;
		this.store.save(this.progress);
		this.changed();
		return after;
	}

	private day(now: number): DayLog {
		const k = localDay(now);
		return (this.progress.days[k] ??= { n: 0, right: 0, fresh: {} });
	}

	/** Cards of `ids` due now, most overdue first. */
	due(mode: CardMode, ids: readonly string[], now = Date.now()): string[] {
		return ids
			.map((id) => [id, this.card(mode, id)] as const)
			.filter(([, c]) => c && c.reps > 0 && c.due <= now)
			.sort((a, b) => a[1]!.due - b[1]!.due)
			.map(([id]) => id);
	}

	/** When the next of `ids` falls due after `now`, or null if none is scheduled. */
	nextDue(mode: CardMode, ids: readonly string[], now = Date.now()): number | null {
		let soonest: number | null = null;
		for (const id of ids) {
			const c = this.card(mode, id);
			if (c && c.reps > 0 && c.due > now && (soonest === null || c.due < soonest)) soonest = c.due;
		}
		return soonest;
	}

	/** `ids` never answered in this mode, in the given order. */
	unseen(mode: CardMode, ids: readonly string[]): string[] {
		return ids.filter((id) => !this.card(mode, id)?.reps);
	}

	/** Seen cards of `ids`, least likely to be recalled first. */
	weakest(mode: CardMode, ids: readonly string[], now = Date.now()): string[] {
		return ids
			.map((id) => [id, this.card(mode, id)] as const)
			.filter(([, c]) => c && c.reps > 0)
			.map(([id, c]) => [id, recall(c!, now)] as const)
			.sort((a, b) => a[1] - b[1])
			.map(([id]) => id);
	}

	/** Today's daily (UTC), finished or in progress. */
	daily(now = Date.now()): DailyResult | undefined {
		return this.progress.daily[utcDay(now)];
	}

	/**
	 * Saves the daily after every answer, so a reload resumes the round
	 * rather than starting it again (one attempt a day).
	 */
	saveDaily(date: string, result: DailyResult, now = Date.now()) {
		this.progress.daily[date] = result;
		this.progress.updated = now;
		this.store.save(this.progress);
		this.changed();
	}

	/** Daily challenges in a row (finished ones), up to today. */
	dailyStreak(now = Date.now()): number {
		const done = Object.fromEntries(Object.entries(this.progress.daily).filter(([, r]) => r.marks.length >= 10));
		return streak(done, utcDay(now));
	}

	/** Days in a row with any practice, up to today (local days). */
	practiceStreak(now = Date.now()): number {
		const played = Object.fromEntries(Object.entries(this.progress.days).filter(([, d]) => d.n > 0));
		return streak(played, localDay(now));
	}

	/** Records a finished speed run; true when it is a new personal best. */
	saveSpeed(scope: string, result: SpeedResult): boolean {
		const old = this.progress.best[scope];
		const best = !old || better(result, old);
		if (best) this.progress.best[scope] = result;
		this.progress.updated = result.at;
		this.store.save(this.progress);
		this.changed();
		return best;
	}

	/**
	 * Records a finished run on Play. Returns whether it is the best run of
	 * that length so far (more right, then faster), and the one it beat.
	 */
	saveRun(run: RunResult): { best: boolean; previous?: RunResult } {
		const previous = this.bestRun(run.n);
		this.progress.runs = [...this.progress.runs, run].slice(-MAX_RUNS);
		this.progress.updated = run.at;
		this.store.save(this.progress);
		this.changed();
		return { best: !previous || previous.right < run.right || (previous.right === run.right && previous.ms > run.ms), previous };
	}

	/** Runs of one length, oldest first. */
	runs(n: number): RunResult[] {
		return this.progress.runs.filter((r) => r.n === n);
	}

	bestRun(n: number): RunResult | undefined {
		let best: RunResult | undefined;
		for (const r of this.runs(n)) if (!best || r.right > best.right || (r.right === best.right && r.ms < best.ms)) best = r;
		return best;
	}

	newPerDay(): number {
		return this.settings.newPerDay ?? DEFAULT_NEW_PER_DAY;
	}

	/** New cards still allowed today in this mode. */
	newLeftToday(mode: CardMode, now = Date.now()): number {
		const today = this.progress.days[localDay(now)];
		return Math.max(0, this.newPerDay() - (today?.fresh[mode] ?? 0));
	}

	/** Mastery counts over `ids` for one mode. */
	counts(mode: CardMode, ids: readonly string[]): Record<Level, number> {
		const out: Record<Level, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
		for (const id of ids) out[this.level(mode, id)]++;
		return out;
	}
}
