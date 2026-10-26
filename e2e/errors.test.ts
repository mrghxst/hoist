import { expect, test, type Page } from '@playwright/test';

// M7: the quiz keeps working when storage is blocked or the map does not load.

async function ready(page: Page) {
	await expect(page.locator('#answer')).toHaveAttribute('aria-busy', 'false');
}

async function answerJapan(page: Page) {
	await page.locator('#answer').fill('Japan');
	await page.keyboard.press('Enter');
	await expect(page.locator('.verdict')).toContainText('Japan');
	await expect(page.locator('.verdict')).toContainText('✓');
}

test('with storage blocked the quiz works and says progress is not saved', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', {
			get() {
				throw new DOMException('The operation is insecure.', 'SecurityError');
			}
		});
	});
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/?deck=JP');
	await ready(page);
	await expect(page.getByText("Progress won't be saved in this browser.")).toBeVisible();
	await answerJapan(page);
	for (const path of ['/practice', '/progress', '/flags', '/daily']) {
		await page.goto(path);
		await expect(page.locator('h1').first()).toBeVisible();
	}
	expect(errors).toEqual([]);
});

test('without the map the quiz still works with typed answers', async ({ page }) => {
	await page.route('**/geo/**', (route) => route.abort());
	await page.goto('/?deck=JP,BR');
	await ready(page);
	await expect(page.getByText('The map did not load')).toBeVisible();
	await answerJapan(page);
	await page.keyboard.press('Enter');
	await expect(page.locator('.flag-card img')).toBeVisible();
});
