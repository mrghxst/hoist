// Full-resolution screenshots for visual review (not part of CI).
// node scripts/dev/shots.ts <url-path> <out-dir> [js to run before the shot]
import { chromium } from '@playwright/test';

const [path = '/', out = '.', script = ''] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:5173';
const browser = await chromium.launch();
for (const scheme of ['light', 'dark'] as const) {
	for (const [w, h] of [
		[1440, 900],
		[375, 812]
	] as const) {
		const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: w < 500 ? 2 : 1 });
		await page.goto(base + path + (path.includes('?') ? '&' : '?') + 'test');
		await page.waitForFunction(() => (window as unknown as { __globe?: unknown }).__globe, null, { timeout: 15000 }).catch(() => {});
		if (script) await page.evaluate(script);
		await page.waitForTimeout(1800);
		await page.screenshot({ path: `${out}/${w}-${scheme}.png` });
		await page.close();
	}
}
await browser.close();
