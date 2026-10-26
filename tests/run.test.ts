import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLength, parseSeed, runIds, runOrder, runPath, runPool, runShareText, seedText } from '../src/lib/play/run.ts';
import { firstFlagScript } from '../src/lib/server/first-flag.ts';
import type { GameData } from '../src/lib/data/types.ts';

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const byId = (id: string) => data.countries.find((c) => c.id === id)!;

describe('runs (owner, M8)', () => {
	it('draws from the 197 only', () => {
		expect(runPool(data)).toHaveLength(197);
	});

	it('a seed fixes the order: no repeats, same seed same flags', () => {
		const pool = runPool(data);
		const a = runIds(pool, 12345, 20);
		expect(new Set(a).size).toBe(20);
		expect(runIds(pool, 12345, 20)).toEqual(a);
		expect(runIds(pool, 12346, 20)).not.toEqual(a);
		// A longer run of the same seed starts with the same flags.
		expect(runIds(pool, 12345, 30).slice(0, 20)).toEqual(a);
		expect(runIds(pool, 1, 500)).toHaveLength(197);
	});

	it('is a permutation for any seed', () => {
		for (const seed of [0, 1, 2 ** 31, 2 ** 32 - 1]) expect([...runOrder(197, seed)].sort((x, y) => x - y)).toEqual([...Array(197).keys()]);
	});

	it('reads seeds and lengths from the address, and writes them back', () => {
		expect(parseSeed(seedText(4294967295))).toBe(4294967295);
		expect(parseSeed('k3x9ab')).toBe(parseInt('k3x9ab', 36));
		expect(parseSeed('ZZ')).toBeNull();
		expect(parseSeed('zzzzzzz')).toBeNull();
		expect(parseLength('20', 197)).toBe(20);
		expect(parseLength('2', 197)).toBeNull();
		expect(parseLength('198', 197)).toBeNull();
		expect(runPath(20, 35)).toBe('/?n=20&seed=z');
	});

	it('shares the score and a link to the same flags', () => {
		const text = runShareText({ n: 4, right: 3, ms: 41_000, at: 0, marks: 'GGRG', seed: 35 });
		expect(text).toBe('Hoist · 4 flags · 3/4 (75%) · 0:41\n🟩🟩🟥🟩\nSame flags: https://hoist.itsanon.com/?n=4&seed=z');
	});

	it('the inline script picks the same first flag as the app', () => {
		const pool = runPool(data);
		// Every other flag marked light, to see the rule at work.
		const core = data.countries.filter((c) => c.pack === 'core');
		const flags = core.map((c, i) => [c.flag.slice('/flags/'.length), c.ratio, (i % 2) as 0 | 1] as [string, number, 0 | 1]);
		const play = (search: string) => {
			const img = { width: 0, height: 0, src: '', style: { setProperty() {}, aspectRatio: 0 } };
			const win: { __hoistRun?: { seed: number } } = {};
			new Function('location', 'document', 'window', firstFlagScript(flags, { w: 320, h: 200 }))({ search }, { getElementById: () => img }, win);
			return { img, seed: win.__hoistRun!.seed };
		};
		const linked = play('?seed=k3x9ab');
		const first = data.countries.find((c) => c.id === runIds(pool, parseSeed('k3x9ab')!, 1)[0])!;
		expect(linked.seed).toBe(parseSeed('k3x9ab'));
		expect(linked.img.src).toBe(first.flag);
		expect(linked.img.width).toBe(Math.round(Math.min(320, 200 * first.ratio)));
		for (let k = 0; k < 20; k++) {
			const random = play('');
			const id = runIds(pool, random.seed, 1)[0]!;
			expect(random.img.src).toBe(byId(id).flag);
			expect(core.indexOf(byId(id)) % 2).toBe(1);
		}
	});
});
