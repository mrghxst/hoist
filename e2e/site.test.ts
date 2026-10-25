import { expect, test, type Page } from '@playwright/test';

// M6: offline play, the flag pages, share images, sitemap and the language setting.

async function ready(page: Page) {
	await expect(page.locator('#answer')).toHaveAttribute('aria-busy', 'false');
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('seeded')) {
			localStorage.clear();
			sessionStorage.setItem('seeded', '1');
		}
	});
});

test.describe('offline', () => {
	test.use({ serviceWorkers: 'allow' });

	test('the quiz works offline after one visit', async ({ page, context }) => {
		await page.goto('/');
		await ready(page);
		// Installed means the precache is complete.
		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});
		await context.setOffline(true);
		await page.reload();
		await ready(page);
		await page.locator('#answer').fill('Japan');
		await page.keyboard.press('Enter');
		await expect(page.locator('.verdict')).toContainText('✓');
		await expect(page.locator('.flag-card img')).toHaveJSProperty('complete', true);
		await context.setOffline(false);
	});
});

test('the flag grid searches, filters and sorts', async ({ page }) => {
	await page.goto('/flags');
	const count = page.locator('.count');
	await expect(count).toHaveText(/^\d+ flags$/);
	await page.getByRole('searchbox', { name: 'Search flags' }).fill('switz');
	await expect(count).toHaveText('1 flag');
	await expect(page.getByRole('link', { name: /Switzerland/ })).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search flags' }).fill('');

	await page.getByRole('group', { name: 'Region' }).getByRole('button', { name: 'Africa' }).click();
	await expect(page.getByRole('link', { name: /Kenya/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^France/ })).toHaveCount(0);

	const byRegion = page.getByRole('group', { name: 'Sort by' }).getByRole('button', { name: 'Region' });
	await byRegion.click();
	await expect(byRegion).toHaveAttribute('aria-pressed', 'true');
});

test('a flag page has its facts and share image', async ({ page }) => {
	await page.goto('/flags/japan');
	await expect(page.getByRole('heading', { level: 1, name: 'Japan' })).toBeVisible();
	await expect(page.locator('dt', { hasText: 'Capital' }).locator('+ dd')).toContainText('Tokyo');
	await expect(page.locator('dt', { hasText: 'Proportions' }).locator('+ dd')).toContainText('2:3');
	await expect(page).toHaveTitle(/Flag of Japan/);
	const og = await page.locator('meta[property="og:image"]').getAttribute('content');
	expect(og).toMatch(/\/flags\/japan\/og\.png$/);
});

test('share images are 1200 × 630 PNGs', async ({ request }) => {
	for (const path of ['/og.png', '/flags/japan/og.png', '/flags/nepal/og.png']) {
		const res = await request.get(path);
		expect(res.status(), path).toBe(200);
		const png = await res.body();
		expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
		// IHDR: width and height, big-endian, at bytes 16 and 20.
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
	}
});

test('the sitemap lists every flag page and robots points at it', async ({ request }) => {
	const xml = await (await request.get('/sitemap.xml')).text();
	expect(xml).toContain('<urlset');
	expect(xml).toMatch(/<loc>https:\/\/[^<]+\/flags\/japan<\/loc>/);
	expect((xml.match(/\/flags\/[a-z-]+<\/loc>/g) ?? []).length).toBeGreaterThanOrEqual(197);
	const robots = await (await request.get('/robots.txt')).text();
	expect(robots).toMatch(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m);
});

test('"Also accept names in" accepts the chosen language', async ({ page }) => {
	await page.goto('/practice');
	const japanese = page.getByRole('group', { name: 'Also accept names in' }).getByRole('button', { name: 'Japanese' });
	await japanese.click();
	await expect(japanese).toHaveAttribute('aria-pressed', 'true');

	// The first starter flag is Japan.
	await page.goto('/');
	await ready(page);
	await page.locator('#answer').fill('日本');
	await page.keyboard.press('Enter');
	await expect(page.locator('.verdict')).toContainText('Japan');
	await expect(page.locator('.verdict')).toContainText('✓');
});
