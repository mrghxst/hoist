import { expect, test } from '@playwright/test';

const routes = ['/', '/daily', '/practice', '/progress', '/flags', '/about', '/lookalikes'];

for (const path of routes) {
	test(`${path} renders with the top bar`, async ({ page }) => {
		await page.goto(path);
		await expect(page.getByRole('link', { name: /Hoist, play/ })).toBeVisible();
		await expect(page.locator('h1').first()).toBeVisible();
	});
}

test('theme toggle cycles and persists', async ({ page }) => {
	await page.goto('/');
	const toggle = page.getByRole('button', { name: /Change theme/ });
	await toggle.click(); // system -> light
	await toggle.click(); // light -> dark
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('unknown pages show the 404', async ({ page }) => {
	const res = await page.goto('/nowhere');
	expect(res?.status()).toBe(404);
	await expect(page.getByText('This page is off the map.')).toBeVisible();
});
