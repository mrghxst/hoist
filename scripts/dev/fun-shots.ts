// Screenshots of the M5 screens for review: the daily result, the speed run,
// a lookalike tip, and progress with a filled-in mastery globe.
// node scripts/dev/fun-shots.ts <out-dir>
import { readFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import type { GameData } from '../../src/lib/data/types.ts';

const out = process.argv[2] ?? '.';
const base = process.env.BASE ?? 'http://localhost:4173';
const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const GPU = ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: GPU });

// A player some weeks in: Europe and the Americas mostly known.
const now = Date.now();
const DAY = 86_400_000;
const cards: Record<string, unknown> = {};
let i = 0;
for (const c of data.countries.filter((c) => c.pack === 'core')) {
	i++;
	const level = c.region === 'europe' ? (i % 5 ? 3 : 2) : c.continent === 'Americas' ? (i % 3 ? 2 : 1) : c.region === 'asia' && i % 2 ? 1 : 0;
	if (!level) continue;
	const s = level === 3 ? 30 : level === 2 ? 8 : 1;
	cards[`flag:${c.id}`] = { due: now + DAY, s, d: 5, reps: 4, lapses: c.id === 'TD' ? 4 : c.id === 'RO' ? 2 : c.id === 'NE' ? 3 : c.id === 'SK' ? 1 : 0, state: level === 1 ? 1 : 2, step: 0, sched: s, last: now - DAY };
}
const days: Record<string, unknown> = {};
for (let d = 0; d < 80; d++) {
	if ((d * 7) % 5 === 0) continue;
	const date = new Date(now - d * DAY).toISOString().slice(0, 10);
	days[date] = { n: (d * 13) % 45, right: 5, fresh: {} };
}
const seed = {
	v: 2,
	settings: { scope: 'all' },
	cards,
	days,
	daily: { [new Date(now).toISOString().slice(0, 10)]: { right: 8, ms: 41_000, marks: 'GGGRGGYGRG' } },
	best: { all: { right: 181, total: 197, ms: 642_000, at: now }, europe: { right: 46, total: 46, ms: 101_000, at: now } },
	updated: now
};

async function shot(page: Page, name: string, wait = 1500) {
	await page.waitForTimeout(wait);
	await page.screenshot({ path: `${out}/${name}.png` });
}

for (const scheme of ['light', 'dark'] as const) {
	for (const [w, h] of [
		[1440, 900],
		[375, 812]
	] as const) {
		const tag = `${w}-${scheme}`;
		const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: w < 500 ? 2 : 1 });
		await ctx.addInitScript((s) => {
			if (!sessionStorage.getItem('seeded')) {
				localStorage.setItem('hoist:v1', JSON.stringify(s));
				sessionStorage.setItem('seeded', '1');
			}
		}, seed);
		const page = await ctx.newPage();
		await page.goto(`${base}/daily`);
		await page.getByRole('heading', { name: /8 of 10/ }).waitFor();
		await shot(page, `${tag}-daily-done`);

		await page.goto(`${base}/practice/speed`);
		await page.getByRole('heading', { name: 'Ready?' }).waitFor();
		await shot(page, `${tag}-speed-start`);

		await page.goto(`${base}/practice/drill?ids=TD`);
		await page.locator('[aria-busy="false"]').first().waitFor();
		while (await page.locator('.eyebrow').count()) await page.keyboard.press('Enter');
		await page.locator('#answer').fill('Romania');
		await page.locator('#answer').press('Enter');
		await shot(page, `${tag}-drill-tip`, 2000);

		await page.goto(`${base}/progress`);
		await page.locator('.totals[aria-busy="false"]').waitFor();
		await shot(page, `${tag}-progress`, 2500);
		await page.screenshot({ path: `${out}/${tag}-progress-full.png`, fullPage: true });

		await page.goto(`${base}/practice`);
		await page.locator('.count:has-text("due")').first().waitFor();
		await page.screenshot({ path: `${out}/${tag}-practice-full.png`, fullPage: true });
		await ctx.close();
	}
}
await browser.close();
