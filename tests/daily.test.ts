import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	addDays,
	clock,
	dailySet,
	DAILY_SIZE,
	EPOCH,
	markOf,
	MIX,
	NO_REPEAT_DAYS,
	shareText,
	streak,
	utcDay,
	type Candidate
} from '../src/lib/learn/daily.ts';
import type { GameData } from '../src/lib/data/types.ts';

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const pool: Candidate[] = data.countries.filter((c) => c.pack === 'core').map((c) => ({ id: c.id, difficulty: c.difficulty }));
const tier = new Map(pool.map((c) => [c.id, c.difficulty]));

describe('daily set (PROMPT.md 2.3)', () => {
	it('is the same for the same date, also when computed from scratch', () => {
		const a = dailySet('2026-10-25', pool);
		// A fresh copy of the pool has no cache: it recomputes from the epoch.
		const b = dailySet('2026-10-25', pool.map((c) => ({ ...c })));
		expect(a).toEqual(b);
		expect(dailySet('2026-10-26', pool)).not.toEqual(a);
	});

	it('has ten different flags: two easy, three medium, five hard, easy first', () => {
		for (let d = 0; d < 60; d++) {
			const set = dailySet(addDays(EPOCH, d), pool);
			expect(set).toHaveLength(DAILY_SIZE);
			expect(new Set(set).size).toBe(DAILY_SIZE);
			const counts = { 1: 0, 2: 0, 3: 0 };
			for (const id of set) counts[tier.get(id)!]++;
			expect(counts).toEqual(MIX);
			expect(tier.get(set[0]!)).toBe(1);
		}
	});

	it(`never repeats a flag within ${NO_REPEAT_DAYS} days, over a year`, () => {
		const seen = new Map<string, string>();
		for (let d = 0; d < 366; d++) {
			const date = addDays(EPOCH, d);
			for (const id of dailySet(date, pool)) {
				const last = seen.get(id);
				if (last) expect(Number(new Date(date)) - Number(new Date(last))).toBeGreaterThan(NO_REPEAT_DAYS * 86_400_000);
				seen.set(id, date);
			}
		}
	});

	it('uses every flag within a few weeks', () => {
		const all = new Set<string>();
		for (let d = 0; d < 40; d++) for (const id of dailySet(addDays(EPOCH, d), pool)) all.add(id);
		expect(all.size).toBeGreaterThan(pool.length * 0.95);
	});

	it('works out the UTC day', () => {
		expect(utcDay(Date.UTC(2026, 9, 25, 23, 59))).toBe('2026-10-25');
		expect(utcDay(Date.UTC(2026, 9, 26, 0, 0))).toBe('2026-10-26');
	});
});

describe('share text', () => {
	it('matches the brief', () => {
		expect(shareText('2026-10-25', { right: 8, ms: 41_000, marks: 'GGGRGGYGRG' })).toBe(
			'Hoist Daily 2026-10-25 · 8/10 · 0:41\n🟩🟩🟩🟥🟩🟩🟨🟩🟥🟩\nhoist.itsanon.com/daily'
		);
	});

	it('marks typos and hints yellow, misses red', () => {
		expect(markOf({ correct: true, typo: false, hints: 0 })).toBe('G');
		expect(markOf({ correct: true, typo: true, hints: 0 })).toBe('Y');
		expect(markOf({ correct: true, typo: false, hints: 2 })).toBe('Y');
		expect(markOf({ correct: false, typo: false, hints: 0 })).toBe('R');
	});

	it('formats times', () => {
		expect(clock(41_000)).toBe('0:41');
		expect(clock(605_400)).toBe('10:05');
		expect(clock(4_500_000)).toBe('1:15:00');
	});
});

describe('streaks', () => {
	const r = { right: 5, ms: 1, marks: 'GGGGG' };

	it('counts days in a row up to today', () => {
		const days = { '2026-10-23': r, '2026-10-24': r, '2026-10-25': r };
		expect(streak(days, '2026-10-25')).toBe(3);
	});

	it('keeps yesterday’s streak while today is still to play', () => {
		const days = { '2026-10-23': r, '2026-10-24': r };
		expect(streak(days, '2026-10-25')).toBe(2);
	});

	it('breaks on a missed day', () => {
		const days = { '2026-10-21': r, '2026-10-22': r, '2026-10-24': r };
		expect(streak(days, '2026-10-25')).toBe(1);
		expect(streak({}, '2026-10-25')).toBe(0);
	});
});
