import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { GameData } from '../src/lib/data/types.ts';

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const byName = new Map(data.countries.map((c) => [c.name, c]));

// The quiz is ready when its console stops being busy (a study card has
// no answer field).
async function ready(page: Page) {
	await expect(page.getByRole('region', { name: 'Quiz' })).toHaveAttribute('aria-busy', 'false');
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('seeded')) {
			localStorage.clear();
			sessionStorage.setItem('seeded', '1');
		}
	});
});

async function starterRound(page: Page) {
	await page.goto('/');
	await ready(page);
	const field = page.locator('#answer');
	for (const id of data.starter) {
		await field.fill(data.countries.find((c) => c.id === id)!.name);
		await field.press('Enter');
		await expect(page.locator('.verdict')).toContainText('✓');
		await field.press('Enter');
	}
	await expect(page.getByRole('heading', { name: '10 of 10 right.' })).toBeVisible();
}

test('after the starter round a region session introduces new flags with study cards', async ({ page }) => {
	await starterRound(page);
	await page.getByRole('button', { name: 'Europe' }).click();
	await expect(page.locator('.eyebrow')).toHaveText('New flag');
	const first = await page.locator('.verdict').textContent();
	expect(byName.get(first!.trim())?.region).toBe('europe');
	await page.keyboard.press('Enter');
	await expect(page.locator('.verdict')).not.toHaveText(first!);
});

test('progress survives a reload and Play goes straight to review', async ({ page }) => {
	await starterRound(page);
	await page.getByRole('button', { name: 'Learn all 197' }).click();
	await page.reload();
	await ready(page);
	await expect(page.locator('.meta')).toContainText('All flags');
	await page.goto('/progress');
	await expect(page.locator('.totals')).toHaveAttribute('aria-busy', 'false');
	const learning = Number(await page.locator('.totals div:nth-child(2) dd').textContent());
	const fresh = Number(await page.locator('.totals div:nth-child(3) dd').textContent());
	expect(learning).toBe(10);
	expect(fresh).toBe(187);
});

test('export, reset and import restore progress exactly', async ({ page }) => {
	await starterRound(page);
	await page.goto('/progress');
	await expect(page.locator('.totals')).toHaveAttribute('aria-busy', 'false');
	const before = await page.evaluate(() => JSON.parse(localStorage.getItem('hoist:v1')!));
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export' }).click();
	const file = await (await download).path();

	await page.getByRole('button', { name: 'Reset…' }).click();
	await page.getByRole('button', { name: 'Delete progress' }).click();
	await expect(page.locator('.totals div:nth-child(3) dd')).toHaveText('197');

	await page.locator('input[type=file]').setInputFiles(file);
	await expect(page.getByRole('status')).toContainText('Imported 10 cards');
	const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hoist:v1')!));
	expect(after.cards).toEqual(before.cards);
	expect(after.days).toEqual(before.days);
});

test('Capitals: study the capital, then type it', async ({ page }) => {
	await page.goto('/practice/capitals');
	await ready(page);
	// Five study cards, then the batch is quizzed.
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('.eyebrow')).toHaveText('New flag');
		await page.keyboard.press('Enter');
	}
	await expect(page.locator('.asking')).toBeVisible();
	const country = (await page.locator('.asking strong').textContent())!.trim();
	const capital = byName.get(country)!.capital.name;
	await expect(page.locator('#answer')).toHaveAttribute('placeholder', 'Type the capital');
	await page.locator('#answer').fill(capital.toLowerCase());
	await page.locator('#answer').press('Enter');
	await expect(page.locator('.verdict')).toContainText('✓');
	await expect(page.locator('.verdict')).toContainText(capital);
});

test('Reverse: the country is on the globe, its name is not in the page', async ({ page }) => {
	// Seed one reverse card that is due, so the session starts with a question.
	await page.addInitScript(() => {
		const now = Date.now();
		const card = { due: now - 1000, s: 3, d: 5, reps: 2, lapses: 0, state: 2, step: 0, sched: 3, last: now - 3 * 86_400_000 };
		localStorage.setItem('hoist:v1', JSON.stringify({ v: 1, settings: {}, cards: { 'reverse:IT': card }, days: {}, updated: now }));
	});
	await page.goto('/practice/reverse');
	await ready(page);
	await expect(page.locator('.prompt-globe')).toContainText('Which country is highlighted?');
	const html = await page.content();
	expect(html).not.toContain('Italy');
	expect(html).not.toContain('Rome');
	await page.locator('#answer').fill('Italy');
	await page.locator('#answer').press('Enter');
	await expect(page.locator('.verdict')).toContainText('✓');
	await expect(page.getByRole('img', { name: 'Flag of Italy' })).toBeVisible();
});

test('Easy mode: pick with the number keys', async ({ page }) => {
	await page.goto('/practice/easy');
	await expect(page.locator('#answer')).toHaveCount(0);
	for (let i = 0; i < 5; i++) {
		await expect(page.locator('.eyebrow')).toHaveText('New flag');
		await page.keyboard.press('Enter');
	}
	const options = page.getByRole('group', { name: /Pick the/ });
	await expect(options.getByRole('button')).toHaveCount(4);
	await page.keyboard.press('1');
	await expect(page.locator('.verdict')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.locator('.verdict')).toHaveCount(0);
});

test('Practice lists the modes with counts', async ({ page }) => {
	await page.goto('/practice');
	await expect(page.getByRole('link', { name: /Review/ })).toContainText('0 due');
	await expect(page.getByRole('link', { name: /Learn new/ })).toContainText('197 new');
	await page.getByRole('button', { name: '20' }).click();
	expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hoist:v1')!).settings.newPerDay)).toBe(20);
});
