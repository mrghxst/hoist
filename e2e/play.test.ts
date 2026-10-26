import { expect, test, type Page } from '@playwright/test';

// The quiz on a fixed list (`?deck=`). Play's runs are in runs.test.ts.

// The field takes typing at once; the quiz data arrives after first paint.
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

test('a wrong answer, then a right one', async ({ page }) => {
	await page.goto('/?deck=JP,BR');
	await ready(page);
	const field = page.locator('#answer');
	await field.fill('China');
	await field.press('Enter');
	await expect(page.locator('.verdict')).toContainText('✗');
	await expect(page.locator('.verdict')).toContainText('Japan');
	await expect(page.getByText("This is China's flag.")).toBeVisible();
	await expect(page.locator('.facts')).toContainText('Tokyo');
	await page.keyboard.press('Enter');
	await field.fill('Brazil');
	await field.press('Enter');
	await expect(page.locator('.verdict')).toContainText('✓');
	await expect(page.locator('.facts')).toContainText('Brasília');
	await expect(page.locator('.facts')).toContainText('São Paulo');
});

test('"Which Congo?" chips are picked with the number keys', async ({ page }) => {
	await page.goto('/?deck=CG,CD');
	await ready(page);
	const field = page.locator('#answer');
	await field.fill('Congo');
	await field.press('Enter');
	await expect(page.getByRole('group', { name: 'Which one?' })).toBeVisible();
	const chips = page.getByRole('group', { name: 'Which one?' }).getByRole('button');
	await expect(chips).toHaveCount(2);
	const second = await chips.nth(1).textContent();
	const pick = second?.includes('Republic of the Congo') && !second.includes('Democratic') ? '2' : '1';
	await page.keyboard.press(pick);
	await expect(page.locator('.verdict')).toContainText('✓ Republic of the Congo'.slice(1));
});

test('a typo is accepted with the spelling shown', async ({ page }) => {
	await page.goto('/?deck=PH');
	await ready(page);
	const field = page.locator('#answer');
	await field.fill('Phillipines');
	await field.press('Enter');
	await expect(page.locator('.verdict')).toContainText('✓');
	await expect(page.getByText('Spelling: Philippines')).toBeVisible();
});

test('Tab gives a letter, Esc gives up', async ({ page }) => {
	await page.goto('/?deck=FR,DE');
	await ready(page);
	const field = page.locator('#answer');
	await field.focus();
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await expect(field).toHaveValue('Fr');
	await page.keyboard.press('Escape');
	await expect(page.locator('.verdict')).toContainText('✗');
	await expect(page.locator('.verdict')).toContainText('France');
});

test('? opens the keyboard help', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	await page.locator('#answer').press('?');
	await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeHidden();
});

test('typing and Enter before the quiz data arrives still count', async ({ page }) => {
	await page.route('**/game.*.json', async (route) => {
		await new Promise((r) => setTimeout(r, 800));
		await route.continue();
	});
	await page.goto('/?deck=JP');
	await expect(page.locator('form.field')).toHaveAttribute('data-hydrated', 'true');
	const field = page.locator('#answer');
	await expect(field).toHaveAttribute('aria-busy', 'true');
	await field.fill('Japan');
	await field.press('Enter');
	await expect(page.locator('.verdict')).toContainText('Japan');
	await expect(page.locator('.verdict')).toContainText('✓');
});

test('the console stays above the on-screen keyboard', async ({ page }, info) => {
	test.skip(info.project.name !== 'phone', 'phones only');
	// Chromium cannot open a virtual keyboard here, so stand in for the
	// visual viewport: the keyboard covers the bottom 300 px.
	await page.addInitScript(() => {
		const target = new EventTarget();
		const vv = Object.assign(target, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
		Object.defineProperty(window, 'visualViewport', { get: () => vv });
		(window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px) => {
			vv.height = innerHeight - px;
			target.dispatchEvent(new Event('resize'));
		};
	});
	await page.goto('/');
	await ready(page);
	await page.locator('#answer').focus();
	await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(300));
	const viewport = page.viewportSize()!;
	await expect
		.poll(async () => (await page.locator('.console').boundingBox())!.y + (await page.locator('.console').boundingBox())!.height)
		.toBeLessThanOrEqual(viewport.height - 300);
	const field = (await page.locator('#answer').boundingBox())!;
	expect(field.y).toBeGreaterThanOrEqual(0);
});

test('text typed before the page hydrates is kept', async ({ page }) => {
	await page.route('**/_app/immutable/nodes/2.*.js', async (route) => {
		await new Promise((r) => setTimeout(r, 800));
		await route.continue();
	});
	await page.goto('/?deck=JP', { waitUntil: 'commit' });
	const field = page.locator('#answer');
	await field.fill('Jap');
	await expect(page.locator('form.field')).toHaveAttribute('data-hydrated', 'true');
	await ready(page);
	await expect(field).toHaveValue('Jap');
	await field.press('End');
	await page.keyboard.type('an');
	await page.keyboard.press('Enter');
	await expect(page.locator('.verdict')).toContainText('✓');
});
