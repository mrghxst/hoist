// Screenshots of the M4 screens for review: practice, a study card,
// capitals, reverse, easy mode (both kinds), progress.
// node scripts/dev/learn-shots.ts <out-dir>
import { chromium, type Page } from '@playwright/test';

const out = process.argv[2] ?? '.';
const base = process.env.BASE ?? 'http://localhost:4173';
const GPU = ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: GPU });

const now = Date.now();
const card = (days: number) => ({ due: now - 1000, s: days, d: 5, reps: 3, lapses: 0, state: 2, step: 0, sched: days, last: now - days * 86_400_000 });
const seed = {
	v: 1,
	settings: { scope: 'all' },
	cards: Object.fromEntries([
		...['JP', 'BR', 'CA', 'DE', 'US', 'GB', 'FR', 'CN', 'KR', 'CH'].map((id) => [`flag:${id}`, card(30)]),
		['reverse:IT', card(3)],
		['capital:JP', card(3)]
	]),
	days: {},
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
		await page.goto(`${base}/practice`);
		await page.locator('.count:has-text("due")').first().waitFor();
		await shot(page, `${tag}-practice`, 300);
		await page.screenshot({ path: `${out}/${tag}-practice-full.png`, fullPage: true });

		await page.goto(`${base}/practice/learn`);
		await page.locator('.eyebrow').waitFor();
		await shot(page, `${tag}-study`);

		await page.goto(`${base}/practice/capitals`);
		await page.locator('.asking').waitFor();
		await shot(page, `${tag}-capitals-ask`);
		await page.locator('#answer').fill('Kyoto');
		await page.locator('#answer').press('Enter');
		await shot(page, `${tag}-capitals-wrong`);

		await page.goto(`${base}/practice/reverse`);
		await page.locator('.prompt-globe').waitFor();
		await shot(page, `${tag}-reverse-ask`, 2200);

		for (let i = 0; i < 6; i++) {
			await page.goto(`${base}/practice/easy`);
			await page.locator('.options').waitFor();
			const flags = await page.locator('.options.flags').count();
			await shot(page, `${tag}-easy-${flags ? 'flags' : 'names'}`, 800);
		}
		await page.goto(`${base}/progress`);
		await page.locator('.totals[aria-busy="false"]').waitFor();
		await shot(page, `${tag}-progress`, 300);
		await ctx.close();
	}
}
await browser.close();
