import { test, expect, type Page } from '@playwright/test';
import { uniqueUser } from './helpers/user';

async function login(page: Page) {
  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('sbexp'));
  await page.getByRole('button', { name: /accedi all/i }).click();
  await expect(page.getByRole('textbox', { name: 'Domanda sui documenti' })).toBeVisible();
}

// Buttons actually rendered (display:none ancestors are excluded by isVisible).
async function visibleExpandButtons(page: Page) {
  const all = await page.getByRole('button', { name: 'Espandi barra laterale', includeHidden: true }).all();
  const visible = [];
  for (const b of all) if (await b.isVisible()) visible.push(b);
  return visible;
}

for (const width of [1280, 768]) {
  test.describe(`sidebar collassata (${width}px)`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('un solo bottone "Espandi barra laterale", nel rail collassato', async ({ page }) => {
      await login(page);
      await page.getByRole('button', { name: 'Chiudi barra laterale' }).click();
      const rail = page.locator('[data-sidebar="collapsed"]');
      await expect(rail).toBeVisible();

      await expect.poll(async () => (await visibleExpandButtons(page)).length).toBe(1);
      await expect(rail.getByRole('button', { name: 'Espandi barra laterale' })).toBeVisible();
      await expect(page.locator('header').getByRole('button', { name: 'Espandi barra laterale' })).toBeHidden();

      await rail.getByRole('button', { name: 'Espandi barra laterale' }).click();
      await expect(page.getByRole('button', { name: 'Chiudi barra laterale' })).toBeVisible();
      await expect(rail).toBeHidden();
    });
  });
}

test.describe('sidebar chiusa (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('il bottone della topbar è l\'unico, raggiungibile da tastiera e apre la sidebar', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('button', { name: 'Chiudi barra laterale' })).toHaveCount(0);

    await expect.poll(async () => (await visibleExpandButtons(page)).length).toBe(1);
    const opener = page.locator('header').getByRole('button', { name: 'Espandi barra laterale' });
    await expect(opener).toBeVisible();

    // Reach it with Tab only.
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    let focused = false;
    for (let i = 0; i < 30 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await opener.evaluate((el) => el === document.activeElement);
    }
    expect(focused).toBe(true);

    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Chiudi barra laterale' })).toBeVisible();
  });

  test('Space attiva il bottone della topbar', async ({ page }) => {
    await login(page);
    const opener = page.locator('header').getByRole('button', { name: 'Espandi barra laterale' });
    await opener.focus();
    await expect(opener).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Chiudi barra laterale' })).toBeVisible();
  });
});
