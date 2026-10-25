import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AGAIN, EASY, GOOD, HARD, rate, type Rating } from '../src/lib/learn/grade.ts';
import { batches, groupsOf, introductionOrder } from '../src/lib/learn/introduce.ts';
import { Learner, localDay } from '../src/lib/learn/learner.ts';
import { Planner } from '../src/lib/learn/plan.ts';
import { MAX_DUE, SessionQueue, type Item, type Similarity } from '../src/lib/learn/queue.ts';
import { intervalDays, level, recall, review } from '../src/lib/learn/scheduler.ts';
import { emptyProgress, migrate } from '../src/lib/learn/schema.ts';
import { LocalStore, MemoryStore } from '../src/lib/learn/store.ts';
import { exportProgress, merge, parseImport } from '../src/lib/learn/transfer.ts';
import type { GameData } from '../src/lib/data/types.ts';

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const core = data.countries.filter((c) => c.pack === 'core').map((c) => c.id);
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5, 9, 0, 0);

/** Seeded random (mulberry32), so every run is the same. */
function seeded(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function learner(initial: unknown = {}) {
	const l = new Learner(new MemoryStore(initial));
	l.saveSettings = () => {};
	return l;
}

function drain(q: SessionQueue, answer: (item: Item) => Rating = () => GOOD, limit = 1000): Item[] {
	const shown: Item[] = [];
	for (let item = q.next(); item && shown.length < limit; item = q.next()) {
		shown.push(item);
		if (!item.study) q.record(item.id, answer(item));
	}
	return shown;
}

describe('grading (PROMPT.md 3.2)', () => {
	it.each([
		[{ correct: false, ms: 2000 }, AGAIN],
		[{ correct: false, gaveUp: true, ms: 9000 }, AGAIN],
		[{ correct: true, gaveUp: true, ms: 2000 }, AGAIN],
		[{ correct: false, picked: true, ms: 1000 }, AGAIN],
		[{ correct: true, hints: 1, ms: 2000 }, HARD],
		[{ correct: true, typo: true, ms: 2000 }, HARD],
		[{ correct: true, ms: 4000 }, GOOD],
		[{ correct: true, ms: 12000 }, GOOD],
		[{ correct: true, ms: 3999 }, EASY],
		[{ correct: true, picked: true, ms: 900 }, HARD]
	])('%o → %i', (answer, rating) => {
		expect(rate(answer)).toBe(rating);
	});
});

describe('schema and migrations', () => {
	it('reads nothing as an empty store', () => {
		for (const raw of [null, undefined, 42, 'x', []]) {
			const m = migrate(raw, T0);
			expect(m.ok).toBe(true);
			expect(m.progress).toEqual(emptyProgress(T0));
		}
	});

	it('migrates v0 (settings only, M0–M3) and keeps the settings', () => {
		const m = migrate({ settings: { theme: 'dark', scope: 'europe', bogus: 1 } }, T0);
		expect(m).toMatchObject({ ok: true, from: 0 });
		expect(m.progress.settings).toEqual({ theme: 'dark', scope: 'europe' });
		expect(m.progress.v).toBe(1);
	});

	it('drops broken cards and days but keeps the rest', () => {
		const good = review(undefined, GOOD, T0);
		const m = migrate({
			v: 1,
			cards: { 'flag:JP': good, 'flag:XX1': good, 'flag:BR': { ...good, s: 'x' }, 'flag:FR': { ...good, state: 7 } },
			days: { '2026-01-05': { n: 3, right: 2, fresh: { flag: 1, bogus: 4 } }, nope: { n: 1, right: 1, fresh: {} } },
			updated: T0
		});
		expect(Object.keys(m.progress.cards)).toEqual(['flag:JP']);
		expect(m.progress.days).toEqual({ '2026-01-05': { n: 3, right: 2, fresh: { flag: 1 } } });
	});

	it('flags a store written by a newer version', () => {
		const m = migrate({ v: 2, settings: { theme: 'dark' } });
		expect(m.ok).toBe(false);
		expect(m.progress.settings.theme).toBe('dark');
	});
});

describe('scheduler', () => {
	it('schedules a first Good soon and grows intervals with each Good', () => {
		let c = review(undefined, GOOD, T0);
		let t = T0;
		const intervals: number[] = [];
		for (let i = 0; i < 6; i++) {
			t = c.due;
			c = review(c, GOOD, t);
			intervals.push(intervalDays(c));
		}
		for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]!);
		expect(intervals.at(-1)).toBeGreaterThan(30);
	});

	it('Easy schedules further out than Good, Hard closer, Again resets', () => {
		const base = review(review(review(undefined, GOOD, T0), GOOD, T0 + DAY), GOOD, T0 + 4 * DAY);
		const t = base.due;
		const [a, h, g, e] = [AGAIN, HARD, GOOD, EASY].map((r) => review(base, r as Rating, t));
		expect(e!.due).toBeGreaterThan(g!.due);
		expect(g!.due).toBeGreaterThan(h!.due);
		expect(h!.due).toBeGreaterThan(a!.due);
		expect(a!.lapses).toBe(base.lapses + 1);
	});

	it('levels go from untouched to mastered', () => {
		expect(level(undefined)).toBe(0);
		let c = review(undefined, GOOD, T0);
		expect(level(c)).toBe(1);
		while (c.s < 21) c = review(c, GOOD, c.due);
		expect(level(c)).toBe(3);
		expect(recall(c, c.last)).toBeCloseTo(1, 2);
	});
});

describe('session queue (PROMPT.md 3.2)', () => {
	it('shows due cards first, most overdue first, at most 50', () => {
		const due = Array.from({ length: 60 }, (_, i) => `D${i}`);
		const q = new SessionQueue({ due, fresh: [['N1', 'N2']], random: seeded(1) });
		const shown = drain(q);
		expect(shown.slice(0, MAX_DUE).map((i) => i.id)).toEqual(due.slice(0, MAX_DUE));
		expect(shown.filter((i) => i.id.startsWith('D'))).toHaveLength(MAX_DUE);
		expect(shown.slice(MAX_DUE).map((i) => i.id)).toContain('N1');
	});

	it('introduces new cards as study cards, then quizzes the batch mixed', () => {
		const batch = ['A', 'B', 'C', 'D', 'E'];
		const q = new SessionQueue({ due: [], fresh: [batch], random: seeded(7) });
		const shown = drain(q);
		expect(shown.slice(0, 5)).toEqual(batch.map((id) => ({ id, study: true })));
		const quizzed = shown.slice(5).map((i) => i.id);
		expect([...quizzed].sort()).toEqual(batch);
		expect(shown.slice(5).every((i) => !i.study)).toBe(true);
	});

	it('never shows the same flag twice in a row', () => {
		for (let seed = 1; seed <= 50; seed++) {
			const r = seeded(seed);
			const q = new SessionQueue({ due: ['A', 'B', 'C', 'D'], fresh: [['E', 'F', 'G']], random: r });
			const shown = drain(q, () => (r() < 0.4 ? AGAIN : GOOD));
			for (let i = 1; i < shown.length; i++) expect(shown[i]!.id).not.toBe(shown[i - 1]!.id);
		}
	});

	it('brings an Again back after 3 to 6 other cards, until right once', () => {
		for (let seed = 1; seed <= 40; seed++) {
			const due = Array.from({ length: 12 }, (_, i) => `C${i}`);
			const q = new SessionQueue({ due, random: seeded(seed) });
			let misses = 0;
			const shown = drain(q, (item) => (item.id === 'C0' && misses++ < 2 ? AGAIN : GOOD));
			const at = shown.flatMap((item, i) => (item.id === 'C0' ? [i] : []));
			expect(at).toHaveLength(3);
			for (let k = 1; k < at.length; k++) {
				const gap = at[k]! - at[k - 1]! - 1;
				expect(gap).toBeGreaterThanOrEqual(3);
				expect(gap).toBeLessThanOrEqual(6);
			}
		}
	});

	it('an Again with nothing else left stays due for next time', () => {
		const q = new SessionQueue({ due: ['A'] });
		expect(drain(q, () => AGAIN).map((i) => i.id)).toEqual(['A']);
	});

	it('keeps near-identical flags apart when it can', () => {
		const sim: Record<string, Similarity> = {
			TD: { region: 'africa', colours: ['blue', 'yellow', 'red'], groups: ['chad-romania'] },
			RO: { region: 'europe', colours: ['blue', 'yellow', 'red'], groups: ['chad-romania'] },
			JP: { region: 'asia', colours: ['white', 'red'], groups: [] },
			BR: { region: 'south-america', colours: ['green', 'yellow', 'blue'], groups: [] }
		};
		for (let seed = 1; seed <= 30; seed++) {
			const q = new SessionQueue({ due: ['TD', 'RO', 'JP', 'BR'], similarity: (id) => sim[id], random: seeded(seed) });
			const ids = drain(q).map((i) => i.id);
			const a = ids.indexOf('TD');
			const b = ids.indexOf('RO');
			expect(Math.abs(a - b)).toBeGreaterThan(1);
		}
	});

	it('the lookalike drill may put them side by side', () => {
		const sim = (id: string): Similarity => ({ region: 'x', colours: ['a', 'b'], groups: ['g'] });
		const q = new SessionQueue({ due: ['TD', 'RO'], similarity: (id) => sim(id), interleave: false });
		expect(drain(q).map((i) => i.id)).toEqual(['TD', 'RO']);
	});

	it('never quizzes a flag before its study card', () => {
		for (let seed = 1; seed <= 50; seed++) {
			const sim = (): Similarity => ({ region: 'x', colours: ['a', 'b'], groups: ['g'] });
			const q = new SessionQueue({ due: [], fresh: [['A', 'B', 'C', 'D', 'E']], similarity: sim, random: seeded(seed) });
			const shown = drain(q);
			const seen = new Set<string>();
			for (const item of shown) {
				if (item.study) seen.add(item.id);
				else expect(seen.has(item.id)).toBe(true);
			}
		}
	});

	it('counts questions, not study cards, in its progress', () => {
		const q = new SessionQueue({ due: ['A'], fresh: [['B', 'C']], random: seeded(3) });
		expect(q.progress()).toEqual({ done: 0, total: 3 });
		const a = q.next()!;
		q.record(a.id, GOOD);
		expect(q.progress()).toEqual({ done: 1, total: 3 });
	});
});

describe('introducing new flags (PROMPT.md 7.2)', () => {
	const order = introductionOrder(data.countries, data.familiar);
	const groups = groupsOf(data.lookalikes);

	it('starts with the well-known flags and covers everything once', () => {
		expect(order.slice(0, data.familiar.length)).toEqual(data.familiar);
		expect(new Set(order).size).toBe(data.countries.length);
	});

	it('never puts two members of one lookalike group in a batch', () => {
		const all = batches(order, order.length, groups);
		expect(all.flat().sort()).toEqual([...order].sort());
		for (const b of all) {
			expect(b.length).toBeLessThanOrEqual(5);
			const seen = new Set<string>();
			for (const id of b) {
				for (const g of groups(id)) {
					expect(seen.has(g), `${g} twice in [${b}]`).toBe(false);
					seen.add(g);
				}
			}
		}
	});

	it('takes only as many as asked', () => {
		expect(batches(order, 7, groups).flat()).toHaveLength(7);
		expect(batches(order, 0, groups)).toEqual([]);
	});
});

describe('learner', () => {
	it('logs answers per local day and counts new cards per mode', () => {
		const l = learner();
		l.answer('flag', 'JP', GOOD, T0);
		l.answer('flag', 'BR', AGAIN, T0 + 1000);
		l.answer('flag', 'JP', GOOD, T0 + 2000);
		l.answer('capital', 'JP', GOOD, T0 + 3000);
		expect(l.progress.days[localDay(T0)]).toEqual({ n: 4, right: 3, fresh: { flag: 2, capital: 1 } });
		expect(l.newLeftToday('flag', T0)).toBe(8);
		expect(l.newLeftToday('capital', T0)).toBe(9);
	});

	it('warm-up answers (the starter round) do not use up new cards', () => {
		const l = learner();
		for (const id of ['JP', 'BR', 'CA']) l.answer('flag', id, GOOD, T0, true);
		expect(l.newLeftToday('flag', T0)).toBe(10);
		expect(l.progress.days[localDay(T0)]).toEqual({ n: 3, right: 3, fresh: {} });
	});

	it('the daily new limit follows the setting', () => {
		const l = learner({ settings: { newPerDay: 5 } });
		for (const id of ['JP', 'BR', 'CA', 'DE', 'US', 'GB']) l.answer('flag', id, GOOD, T0);
		expect(l.newLeftToday('flag', T0)).toBe(0);
		expect(l.newLeftToday('flag', T0 + DAY)).toBe(5);
	});

	it('lists due cards most overdue first', () => {
		const l = learner();
		l.answer('flag', 'JP', GOOD, T0);
		l.answer('flag', 'BR', GOOD, T0 + 60_000);
		expect(l.due('flag', ['BR', 'JP', 'CA'], T0 + 7 * DAY)).toEqual(['JP', 'BR']);
		expect(l.due('flag', ['BR', 'JP'], T0)).toEqual([]);
		expect(l.unseen('flag', ['BR', 'JP', 'CA'])).toEqual(['CA']);
	});
});

describe('storage of progress', () => {
	class MemoryStorage {
		map = new Map<string, string>();
		getItem(k: string) {
			return this.map.get(k) ?? null;
		}
		setItem(k: string, v: string) {
			this.map.set(k, v);
		}
		removeItem(k: string) {
			this.map.delete(k);
		}
	}

	beforeEach(() => {
		(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
	});

	it('keeps progress across a reload', () => {
		const a = new Learner(new LocalStore());
		a.answer('flag', 'JP', GOOD, T0);
		a.answer('flag', 'BR', HARD, T0 + 5000);
		a.setSettings({ newPerDay: 20 });
		const b = new Learner(new LocalStore());
		expect(b.progress).toEqual(a.progress);
		expect(b.settings.newPerDay).toBe(20);
	});

	it('does not undo a setting saved elsewhere meanwhile', () => {
		const a = new Learner(new LocalStore());
		const raw = JSON.parse(localStorage.getItem('hoist:v1') ?? '{}');
		localStorage.setItem('hoist:v1', JSON.stringify({ ...raw, settings: { theme: 'dark' } }));
		a.answer('flag', 'JP', GOOD, T0);
		expect(JSON.parse(localStorage.getItem('hoist:v1')!).settings).toEqual({ theme: 'dark' });
	});

	it('never overwrites a store saved by a newer version', () => {
		localStorage.setItem('hoist:v1', JSON.stringify({ v: 9, settings: {}, future: true }));
		const l = new Learner(new LocalStore());
		expect(l.persistent).toBe(false);
		l.answer('flag', 'JP', GOOD, T0);
		expect(JSON.parse(localStorage.getItem('hoist:v1')!)).toEqual({ v: 9, settings: {}, future: true });
	});

	it('stays under 200 KB for all 197 countries in all three modes', () => {
		const l = learner();
		let t = T0;
		for (const mode of ['flag', 'capital', 'reverse'] as const) {
			for (const id of core) {
				let c = l.answer(mode, id, GOOD, (t += 1000));
				for (let i = 0; i < 5; i++) c = l.answer(mode, id, i === 2 ? AGAIN : GOOD, c.due);
			}
		}
		for (let d = 0; d < 365; d++) l.progress.days[localDay(T0 + d * DAY)] = { n: 120, right: 100, fresh: { flag: 10, capital: 10, reverse: 10 } };
		const bytes = new TextEncoder().encode(JSON.stringify(l.progress)).length;
		expect(bytes).toBeLessThan(200_000);
	});
});

describe('export and import', () => {
	function played() {
		const l = learner({ settings: { theme: 'dark', newPerDay: 20 } });
		let t = T0;
		for (const id of core.slice(0, 40)) l.answer('flag', id, (t / 1000) % 3 ? GOOD : AGAIN, (t += 7_000));
		for (const id of core.slice(0, 10)) l.answer('capital', id, HARD, (t += 7_000));
		return l;
	}

	it('an export imported into an empty store restores it exactly', () => {
		const src = played();
		const parsed = parseImport(exportProgress(src.progress));
		expect(parsed.ok).toBe(true);
		const dst = learner();
		dst.replace(merge(dst.progress, parsed.ok ? parsed.progress : emptyProgress()));
		expect(dst.progress.cards).toEqual(src.progress.cards);
		expect(dst.progress.days).toEqual(src.progress.days);
		expect(dst.progress.settings).toEqual(src.progress.settings);
	});

	it('merges by the most recent review', () => {
		const a = learner();
		a.answer('flag', 'JP', GOOD, T0);
		a.answer('flag', 'BR', GOOD, T0 + 10 * DAY);
		const b = learner();
		b.answer('flag', 'JP', AGAIN, T0 + 5 * DAY);
		b.answer('flag', 'BR', AGAIN, T0 + 2 * DAY);
		b.answer('flag', 'CA', GOOD, T0 + 3 * DAY);
		const m = merge(a.progress, b.progress);
		expect(m.cards['flag:JP']).toEqual(b.progress.cards['flag:JP']);
		expect(m.cards['flag:BR']).toEqual(a.progress.cards['flag:BR']);
		expect(m.cards['flag:CA']).toEqual(b.progress.cards['flag:CA']);
	});

	it('rejects files that are not Hoist progress', () => {
		expect(parseImport('{nope').ok).toBe(false);
		expect(parseImport('{"app":"other"}').ok).toBe(false);
		expect(parseImport(JSON.stringify({ app: 'hoist', kind: 'progress', progress: { v: 3 } })).ok).toBe(false);
	});
});

describe('a simulated month of daily sessions', () => {
	it('gives sensible intervals', () => {
		const l = learner();
		const planner = new Planner(data, l);
		const rand = seeded(42);
		// A learner who recalls with the chance FSRS predicts, a bit worse
		// for flags they have barely seen.
		const answer = (id: string, now: number): Rating => {
			const c = l.card('flag', id);
			const p = c ? recall(c, now) : 0.6;
			const r = rand();
			if (r > p) return AGAIN;
			return r < p * 0.3 ? EASY : r > p * 0.9 ? HARD : GOOD;
		};
		const perDay: { due: number; fresh: number; shown: number }[] = [];
		for (let day = 0; day < 30; day++) {
			let now = T0 + day * DAY;
			const plan = planner.plan({ mode: 'flag', ids: core, now, random: rand });
			let shown = 0;
			for (let item = plan.queue.next(); item; item = plan.queue.next()) {
				now += 8000;
				shown++;
				if (item.study) continue;
				const r = answer(item.id, now);
				l.answer('flag', item.id, r, now);
				plan.queue.record(item.id, r);
			}
			perDay.push({ due: plan.due, fresh: plan.fresh, shown });
		}

		// Ten new flags a day, every day, until month's end: 300 > 197 caps it.
		const introduced = perDay.reduce((n, d) => n + d.fresh, 0);
		expect(introduced).toBe(Math.min(300, core.length));
		// Reviews stay manageable: never more than the cap.
		for (const d of perDay) expect(d.due).toBeLessThanOrEqual(50);
		// Every introduced card has been reviewed and is scheduled ahead.
		const end = T0 + 30 * DAY;
		const cards = core.map((id) => l.card('flag', id)).filter((c) => !!c);
		expect(cards).toHaveLength(introduced);
		// Cards met in the first week are now spaced weeks apart.
		const early = perDay.slice(0, 7).reduce((n, d) => n + d.fresh, 0);
		const order = introductionOrder(data.countries, data.familiar).filter((id) => core.includes(id));
		const firstWeek = order.slice(0, early).map((id) => l.card('flag', id)!);
		const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
		expect(median(firstWeek.map(intervalDays))).toBeGreaterThan(7);
		// Nothing is scheduled absurdly far out after one month.
		for (const c of cards) expect(intervalDays(c)).toBeLessThan(365);
		// And a reasonable share is due on any given day afterwards.
		const dueAfter = cards.filter((c) => c.due <= end).length;
		expect(dueAfter).toBeLessThan(cards.length / 2);
	});
});
