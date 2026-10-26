import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parseSeed, runIds, runPool } from '../src/lib/play/run.ts';
import type { GameData } from '../src/lib/data/types.ts';

// M8 (owner): Play is runs of random flags, a speed run, and challenge links.

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const pool = runPool(data);
const byId = new Map(data.countries.map((c) => [c.id, c]));
const byFlag = new Map(data.countries.map((c) => [c.flag, c]));
const run = (seed: string, n: number) => runIds(pool, parseSeed(seed)!, n).map((id) => byId.get(id)!);

async function ready(page: Page) {
	await expect(page.locator('#answer')).toHaveAttribute('aria-busy', 'false');
}

async function shown(page: Page) {
	return byFlag.get((await page.locator('.flag-card img').getAttribute('src'))!)!;
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('seeded')) {
			localStorage.clear();
			sessionStorage.setItem('seeded', '1');
		}
	});
});

test('the first flag shows before the app loads, and it is the run’s first', async ({ page }) => {
	await page.route('**/_app/immutable/**', (route) => route.abort());
	await page.goto('/?n=20&seed=abc');
	const img = page.getByRole('img', { name: 'Flag to name' });
	await expect(img).toBeVisible();
	expect(await img.getAttribute('src')).toBe(run('abc', 1)[0]!.flag);
	// Random without a seed, but always a flag, and never its name.
	await page.goto('/');
	await expect(page.getByRole('img', { name: 'Flag to name' })).toHaveAttribute('src', /^\/flags\/[0-9a-f]{12}\.(svg|webp)$/);
});

test('no answer in the page before answering', async ({ page }) => {
	const first = run('abc', 1)[0]!;
	await page.goto('/?n=20&seed=abc');
	await ready(page);
	const html = await page.content();
	expect(html).not.toContain(first.name);
	expect(html).not.toContain(first.capital.name);
	expect(await page.title()).not.toContain(first.name);
});

test('a challenge run by keyboard: same flags, the result and its link', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/?n=10&seed=abc');
	await ready(page);
	await expect(page.locator('.meta')).toContainText('Challenge · 10 flags');
	const flags = run('abc', 10);
	const field = page.locator('#answer');
	for (const [i, c] of flags.entries()) {
		await expect(page.locator('.meta')).toContainText(`${i + 1} of 10`);
		expect((await shown(page)).id).toBe(c.id);
		await field.fill(i === 2 ? 'Atlantis' : c.name);
		await field.press('Enter');
		await expect(page.locator('.verdict')).toContainText(i === 2 ? '✗' : '✓');
		// A right answer moves on by itself; a wrong one waits for Enter.
		if (i === 2) await field.press('Enter');
	}
	await expect(page.getByRole('heading', { name: /9 of 10\s+90%/})).toBeVisible();
	await expect(page.getByText(`Missed: ${flags[2]!.name}.`)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Practise them' })).toHaveAttribute('href', `/practice/drill?ids=${flags[2]!.id}`);
	// Enter is ready to start the next run, like a typing test.
	await expect(page.getByRole('button', { name: /Next run/ })).toBeFocused();
	await page.getByRole('button', { name: 'Challenge friends' }).click();
	const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
	expect(text).toMatch(/^Hoist · 10 flags · 9\/10 \(90%\) · \d+:\d\d\n🟩🟩🟥(🟩){7}\nSame flags: https:\/\/hoist\.itsanon\.com\/\?n=10&seed=abc$/);

	// The next run is random again, the challenge left behind.
	await page.getByRole('button', { name: /Next run/ }).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('.meta')).toContainText('10 flags · 1 of 10');
	await expect(page.locator('.meta')).not.toContainText('Challenge');
	expect(new URL(page.url()).search).toBe('');
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hoist:v1')!).runs.length)).toBe(1);
});

test('runs give no letters, and the bar steps aside while typing', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	await expect(page.locator('#keys')).not.toContainText('Tab');
	const field = page.locator('#answer');
	await field.focus();
	await page.keyboard.press('Tab');
	await expect(field).toHaveValue('');
	await expect(page.locator('.runbar')).not.toHaveClass(/hidden/);
	await page.keyboard.type('a');
	await expect(page.locator('.runbar')).toHaveClass(/hidden/);
});

test('the bar sets the length, kept for next time, and a custom one', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	const bar = page.getByRole('group', { name: 'Flags per run' });
	await expect(bar.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true');
	await bar.getByRole('button', { name: '30' }).click();
	await expect(page.locator('.meta')).toContainText('30 flags · 1 of 30');
	await page.reload();
	await ready(page);
	await expect(page.locator('.meta')).toContainText('30 flags · 1 of 30');
	await bar.getByRole('button', { name: 'custom' }).click();
	await page.getByRole('spinbutton', { name: /Flags per run/ }).fill('7');
	await page.keyboard.press('Enter');
	await expect(page.locator('.meta')).toContainText('7 flags · 1 of 7');
	await expect(bar.getByRole('button', { name: '7' })).toHaveAttribute('aria-pressed', 'true');
});

test('a speed run moves on by itself, letters come slowly, and keeps the best', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	await page.getByRole('button', { name: 'Speed run' }).click();
	await page.getByRole('group', { name: 'Speed run through' }).getByRole('button', { name: 'Oceania' }).click();
	await expect(page.locator('#keys')).toContainText('Tab a letter in 10 s');
	await page.locator('#answer').focus();
	await page.keyboard.press('Tab');
	await expect(page.locator('#answer')).toHaveValue('');
	const total = data.countries.filter((c) => c.pack === 'core' && c.region === 'oceania').length;
	for (let i = 0; i < total; i++) {
		await expect(page.locator('.meta')).toContainText(`Speed run · Oceania · ${i + 1} of ${total}`);
		await page.locator('#answer').fill((await shown(page)).name);
		await page.locator('#answer').press('Enter');
	}
	await expect(page.getByRole('heading', { name: new RegExp(`${total} of ${total} in .*New best`) })).toBeVisible();
	await page.goto('/progress');
	await expect(page.locator('.bests')).toContainText(`${total}/${total}`);
});

test('Progress charts the runs, 20 first', async ({ page }) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('hoist:v1')) return;
		const now = Date.now();
		const r = (n: number, right: number, k: number) => ({ n, right, ms: 60_000, at: now - k * 60_000, seed: k, marks: 'G'.repeat(right) + 'R'.repeat(n - right) });
		localStorage.setItem(
			'hoist:v1',
			JSON.stringify({ v: 3, settings: {}, cards: {}, days: {}, daily: {}, best: {}, runs: [r(20, 10, 5), r(20, 15, 4), r(10, 9, 3), r(20, 18, 2)], updated: now })
		);
	});
	await page.goto('/progress');
	const runs = page.locator('.runs');
	await expect(runs.getByRole('button', { name: '20 flags' })).toHaveAttribute('aria-pressed', 'true');
	await expect(runs.locator('figcaption')).toHaveText('Accuracy of your last 3 runs of 20');
	await expect(runs.locator('.run-stats')).toContainText('18/20');
	await runs.getByRole('button', { name: '10 flags' }).click();
	await expect(runs.locator('figcaption')).toHaveText('Accuracy of your run of 10');
});
