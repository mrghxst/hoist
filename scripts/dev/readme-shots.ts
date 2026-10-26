// The README's screenshots, from a production build (`pnpm build && pnpm preview`).
// node scripts/dev/readme-shots.ts   (writes docs/screenshots/*.webp; commit them)
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import sharp from 'sharp';
import { parseSeed, runIds, runPool } from '../../src/lib/play/run.ts';
import type { GameData } from '../../src/lib/data/types.ts';

const base = process.env.BASE ?? 'http://localhost:4173';
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });
// GPU rasterisation, as on a real laptop; headless otherwise draws in software.
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'] });

async function shot(name: string, page: Page) {
	await sharp(await page.screenshot()).webp({ quality: 86 }).toFile(`${out}/${name}.webp`);
	console.log(`${out}/${name}.webp`);
}

// Math.random fixed, so the run on `/` (no seed in the address) is known.
const FIXED = 0.141; // Brazil first

async function open(path: string, scheme: 'light' | 'dark', width = 1440, height = 900) {
	const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: width < 500 ? 2 : 1 });
	await page.addInitScript((x) => (Math.random = () => x), FIXED);
	await page.goto(base + path);
	return page;
}

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const pool = runPool(data);
/** The names of a seeded run, so the shots can answer it. */
const names = (seed: string, n: number) => runIds(pool, parseSeed(seed)!, n).map((id) => data.countries.find((c) => c.id === id)!.name);

async function ready(page: Page) {
	await page.locator('#answer[aria-busy="false"]').waitFor();
}

/**
 * Answer Brazil and let the globe land. A fixed list (`?deck=`), not a run:
 * a run moves on by itself after a right answer.
 */
async function answerBrazil(page: Page) {
	await ready(page);
	await page.locator('#answer').fill('Brazil');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(2600);
}

/** Play a whole seeded run, missing `miss` of them. */
async function playRun(page: Page, seed: string, n: number, miss: number[]) {
	await ready(page);
	for (const [i, name] of names(seed, n).entries()) {
		await page.locator('#answer').fill(miss.includes(i) ? 'Atlantis' : name);
		await page.keyboard.press('Enter');
		await page.waitForTimeout(miss.includes(i) ? 300 : 700);
		if (miss.includes(i)) await page.keyboard.press('Enter');
	}
	await page.waitForTimeout(600);
}

let page = await open('/', 'dark');
await ready(page);
await page.waitForTimeout(800);
await shot('play-dark', page);
await page.close();

page = await open('/?deck=BR', 'light');
await answerBrazil(page);
await shot('answer-light', page);
await page.close();

page = await open('/?deck=BR', 'dark', 375, 812);
await answerBrazil(page);
await shot('phone-dark', page);
await page.close();

// A few earlier runs, so the result has a chart.
page = await open('/?n=10&seed=a1', 'dark');
await playRun(page, 'a1', 10, [2, 5, 8]);
for (const [seed, miss] of [['a2', [1, 4]], ['a3', [6]], ['a4', [0, 3, 7, 9]]] as const) {
	await page.goto(`${base}/?n=10&seed=${seed}`);
	await playRun(page, seed, 10, [...miss]);
}
await page.goto(`${base}/?n=10&seed=a5`);
await playRun(page, 'a5', 10, [4]);
await page.mouse.move(0, 0);
await shot('results-dark', page);
await page.close();
page = await open('/flags', 'light');
await page.waitForTimeout(800);
await shot('flags-light', page);
await page.close();

page = await open('/flags/switzerland', 'dark');
await page.waitForTimeout(800);
await shot('flag-page-dark', page);
await page.close();

await browser.close();
