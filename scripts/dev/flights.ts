// M2 acceptance: fly Japan → Brazil → Monaco → New Zealand → France,
// screenshot each landing and report frame times (PROMPT.md 10, 14).
// node scripts/dev/flights.ts <out-dir> [--throttle] [--dark] [--phone]
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import type { Country } from '../../src/lib/data/types.ts';

const out = process.argv[2] ?? '.';
const throttle = process.argv.includes('--throttle');
const dark = process.argv.includes('--dark');
const phone = process.argv.includes('--phone');
const base = process.env.BASE ?? 'http://localhost:5173';
const countries = JSON.parse(readFileSync('src/lib/data/countries.json', 'utf8')) as Country[];
const route = ['JP', 'BR', 'MC', 'NZ', 'FR'];

// Real laptops rasterise canvas on the GPU; headless defaults to software.
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: process.argv.includes('--gpu') ? GPU_ARGS : [] });
const page = await browser.newPage({
	viewport: phone ? { width: 375, height: 812 } : { width: 1440, height: 900 },
	deviceScaleFactor: phone ? 2 : 1,
	colorScheme: dark ? 'dark' : 'light'
});
page.on('console', (m) => console.log('  ' + m.text()));
await page.goto(`${base}/?test`);
await page.waitForFunction(() => (window as unknown as { __globe?: unknown }).__globe, null, { timeout: 20000 });
if (throttle) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

const all: number[] = [];
for (const id of route) {
	const c = countries.find((x) => x.id === id)!;
	const times = await page.evaluate(
		async ({ c }) => {
			const g = (window as unknown as { __globe: any }).__globe;
			g.takeFrameTimes();
			g.profile = {};
			await g.flyTo({ id: c.id, centre: c.view.centre, zoom: c.view.zoom });
			g.showMarkers({ capital: c.capital, largest: c.same ? undefined : c.largest });
			const t = g.takeFrameTimes() as number[];
			const prof = Object.fromEntries(Object.entries(g.profile as Record<string, number>).map(([k, v]) => [k, +(v / Math.max(1, t.length)).toFixed(2)]));
			console.log(JSON.stringify(prof));
			return t;
		},
		{ c }
	);
	all.push(...times);
	await page.waitForTimeout(1200);
	await page.screenshot({ path: `${out}/${id}${dark ? '-dark' : ''}${phone ? '-phone' : ''}.png` });
	const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
	console.log(`${id}: ${times.length} frames, mean ${avg.toFixed(2)} ms, max ${Math.max(...times).toFixed(2)} ms`);
}
const sorted = [...all].sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
const mean = all.reduce((a, b) => a + b, 0) / Math.max(1, all.length);
console.log(`all: mean ${mean.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms${throttle ? ' (4× CPU throttle)' : ''}`);
await browser.close();
