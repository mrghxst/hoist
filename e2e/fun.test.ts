import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { dailySet } from '../src/lib/learn/daily.ts';
import type { GameData } from '../src/lib/data/types.ts';

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const pool = data.countries.filter((c) => c.pack === 'core').map((c) => ({ id: c.id, difficulty: c.difficulty }));
const byFlag = new Map(data.countries.map((c) => [c.flag, c]));
const byId = new Map(data.countries.map((c) => [c.id, c]));
const DATE = '2026-10-25';
const NOON = new Date(`${DATE}T12:00:00Z`);

async function ready(page: Page) {
	await expect(page.getByRole('region', { name: 'Quiz' })).toHaveAttribute('aria-busy', 'false');
}

/** The country whose flag is on screen. */
async function shown(page: Page) {
	const src = await page.locator('.flag-card img').getAttribute('src');
	return byFlag.get(src!)!;
}

test.beforeEach(async ({ page }) => {
	await page.clock.setFixedTime(NOON);
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('seeded')) {
			localStorage.clear();
			sessionStorage.setItem('seeded', '1');
		}
	});
});

test('the daily is the same ten flags in two browsers on the same date', async ({ browser }) => {
	const firsts: string[] = [];
	for (let i = 0; i < 2; i++) {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.clock.setFixedTime(NOON);
		await page.goto('/daily');
		await ready(page);
		firsts.push((await shown(page)).id);
		await ctx.close();
	}
	expect(firsts[0]).toBe(firsts[1]);
	expect(firsts[0]).toBe(dailySet(DATE, pool)[0]);
});

test('a daily round, then the share text', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/daily');
	await ready(page);
	const ids = dailySet(DATE, pool);
	const field = page.locator('#answer');
	for (const [i, id] of ids.entries()) {
		expect((await shown(page)).id).toBe(id);
		// Miss the fourth on purpose, take a hint on the seventh.
		if (i === 3) await field.fill('Atlantis');
		else if (i === 6) {
			await field.focus();
			await page.keyboard.press('Tab');
			await field.fill(byId.get(id)!.name);
		} else await field.fill(byId.get(id)!.name);
		await field.press('Enter');
		await expect(page.locator('.verdict')).toBeVisible();
		await field.press('Enter');
	}
	await expect(page.getByRole('heading', { name: /9 of 10/ })).toBeVisible();
	await page.getByRole('button', { name: 'Copy result' }).click();
	// The system clipboard may hand back Windows line ends.
	const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
	expect(text).toMatch(/^Hoist Daily 2026-10-25 · 9\/10 · \d+:\d\d\n🟩🟩🟩🟥🟩🟩🟨🟩🟩🟩\nhoist\.itsanon\.com\/daily$/);

	// One attempt a day: coming back shows the result.
	await page.reload();
	await ready(page);
	await expect(page.getByRole('heading', { name: /9 of 10/ })).toBeVisible();
	await expect(page.locator('#answer')).toHaveCount(0);
});

test('a reload in the middle of the daily carries on where it stopped', async ({ page }) => {
	await page.goto('/daily');
	await ready(page);
	const ids = dailySet(DATE, pool);
	for (const id of ids.slice(0, 3)) {
		await page.locator('#answer').fill(byId.get(id)!.name);
		await page.locator('#answer').press('Enter');
		await expect(page.locator('.verdict')).toBeVisible();
		await page.locator('#answer').press('Enter');
	}
	await page.reload();
	await ready(page);
	expect((await shown(page)).id).toBe(ids[3]);
	await expect(page.locator('.meta')).toContainText('4 of 10');
});

test('a speed run moves on by itself and keeps the best time', async ({ page }) => {
	await page.goto('/practice/speed');
	await ready(page);
	await page.getByRole('button', { name: 'Oceania' }).click();
	const total = data.countries.filter((c) => c.pack === 'core' && c.region === 'oceania').length;
	for (let i = 0; i < total; i++) {
		await expect(page.locator('.meta')).toContainText(`${i + 1} of ${total}`);
		await page.locator('#answer').fill((await shown(page)).name);
		await page.locator('#answer').press('Enter');
	}
	await expect(page.getByRole('heading', { name: new RegExp(`${total} of ${total} in .*A new best`) })).toBeVisible();
	await expect(page.getByRole('button', { name: /Oceania/ })).toContainText(`${total}/${total}`);
});

test('lookalike drills say how to tell the flags apart', async ({ page }) => {
	await page.goto('/practice/drill?ids=TD');
	await ready(page);
	while (await page.locator('.eyebrow').count()) await page.keyboard.press('Enter');
	await page.locator('#answer').fill((await shown(page)).name);
	await page.locator('#answer').press('Enter');
	const tip = data.lookalikes.find((g) => g.members.includes('TD'))!.tip;
	await expect(page.locator('.tip')).toContainText(tip);
});

test('progress shows the mastery globe, the hardest flags and a drill link', async ({ page }) => {
	await page.addInitScript(() => {
		const now = Date.now();
		const card = (s: number, lapses: number) => ({ due: now + 86_400_000, s, d: 5, reps: 5, lapses, state: 2, step: 0, sched: s, last: now });
		localStorage.setItem(
			'hoist:v1',
			JSON.stringify({
				v: 2,
				settings: {},
				cards: { 'flag:JP': card(40, 0), 'flag:FR': card(30, 0), 'flag:TD': card(4, 3), 'flag:RO': card(5, 1) },
				days: {},
				daily: {},
				best: {},
				updated: now
			})
		);
	});
	await page.goto('/progress');
	await expect(page.locator('.totals')).toHaveAttribute('aria-busy', 'false');
	await expect(page.locator('.totals div:nth-child(1) dd')).toHaveText('2');
	await expect(page.getByRole('application', { name: /Mastery globe: 2 mastered, 2 learning/ })).toBeVisible();
	const hardest = page.locator('.hardest li');
	await expect(hardest).toHaveCount(2);
	await expect(hardest.first()).toContainText('Chad');
	await expect(hardest.first()).toContainText('3 misses');
	await expect(hardest.first().getByRole('link', { name: 'Drill' })).toHaveAttribute('href', '/practice/drill?ids=TD');
	await expect(page.locator('.days li')).toHaveCount(84);
});
