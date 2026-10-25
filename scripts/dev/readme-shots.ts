// The README's screenshots, from a production build (`pnpm build && pnpm preview`).
// node scripts/dev/readme-shots.ts   (writes docs/screenshots/*.webp; commit them)
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import sharp from 'sharp';

const base = process.env.BASE ?? 'http://localhost:4173';
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });
// GPU rasterisation, as on a real laptop; headless otherwise draws in software.
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'] });

async function shot(name: string, page: Page) {
	await sharp(await page.screenshot()).webp({ quality: 86 }).toFile(`${out}/${name}.webp`);
	console.log(`${out}/${name}.webp`);
}

async function open(path: string, scheme: 'light' | 'dark', width = 1440, height = 900) {
	const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: width < 500 ? 2 : 1 });
	await page.goto(base + path);
	return page;
}

/** The first starter flag is Japan: answer it and let the globe land. */
async function answerJapan(page: Page) {
	await page.locator('#answer[aria-busy="false"]').waitFor();
	await page.locator('#answer').fill('Japan');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(2600);
}

let page = await open('/', 'dark');
await page.locator('#answer[aria-busy="false"]').waitFor();
await page.waitForTimeout(800);
await shot('play-dark', page);
await page.close();

page = await open('/', 'light');
await answerJapan(page);
await shot('answer-light', page);
await page.close();

page = await open('/', 'dark', 375, 812);
await answerJapan(page);
await shot('phone-dark', page);
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
