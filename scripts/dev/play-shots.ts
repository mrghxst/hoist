// Screenshots of the play loop for review: before, right, wrong, chips.
// node scripts/dev/play-shots.ts <out-dir>
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? '.';
const base = process.env.BASE ?? 'http://localhost:5173';
const GPU = ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: GPU });
for (const scheme of ['light', 'dark'] as const) {
	for (const [w, h] of [
		[1440, 900],
		[375, 812]
	] as const) {
		const tag = `${w}-${scheme}`;
		const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: w < 500 ? 2 : 1 });
		await page.goto(`${base}/?test&deck=CH,NG,CD`);
		await page.locator('#answer:enabled').waitFor();
		await page.waitForTimeout(1200);
		await page.screenshot({ path: `${out}/${tag}-0-ask.png` });
		await page.locator('#answer').fill('Switzerland');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(1900);
		await page.screenshot({ path: `${out}/${tag}-1-right.png` });
		await page.keyboard.press('Enter');
		await page.locator('#answer').fill('Niger');
		await page.locator('#answer').press('Enter');
		await page.waitForTimeout(1900);
		await page.screenshot({ path: `${out}/${tag}-2-wrong.png` });
		await page.keyboard.press('Enter');
		await page.locator('#answer').fill('Congo');
		await page.locator('#answer').press('Enter');
		await page.waitForTimeout(400);
		await page.screenshot({ path: `${out}/${tag}-3-chips.png` });
		await page.close();
	}
}
await browser.close();
