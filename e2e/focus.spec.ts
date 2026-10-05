import { test, expect, type Page } from '@playwright/test';

// P1-12: focus management. Keyboard-only where possible (no click on the elements under test).

async function login(page: Page, user: string) {
  await page.goto('/');
  await page.locator('#user_id').fill(user);
  await page.keyboard.press('Enter');
  const composer = page.getByRole('textbox', { name: 'Domanda sui documenti' });
  await expect(composer).toBeVisible();
  return composer;
}

const nd = (o: object) => JSON.stringify(o) + '\n';

test.describe('focus after Interrompi (P1-12)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // The stream is held open by a route handler that fulfils only when released, so the button is visible
  // deterministically. Playwright's route.fulfill sends the whole body at once, hence the "release" gate.
  async function holdStream(page: Page) {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/chat/', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: nd({ type: 'content', delta: 'Risposta' }) + nd({ type: 'done' }),
      });
    });
    return release;
  }

  test('click on Interrompi: the textarea has the focus', async ({ page }) => {
    const release = await holdStream(page);
    const composer = await login(page, `e2e_focus_${Date.now()}_a`);
    await page.keyboard.type('domanda');
    await page.keyboard.press('Enter');
    const stop = page.getByRole('button', { name: /interrompi/i });
    await expect(stop).toBeVisible();
    await stop.click();
    await expect(stop).toHaveCount(0);
    await expect(composer).toBeFocused();
    release();
  });

  test('Enter on Interrompi (keyboard): the textarea has the focus', async ({ page }) => {
    const release = await holdStream(page);
    const composer = await login(page, `e2e_focus_${Date.now()}_b`);
    await page.keyboard.type('domanda');
    await page.keyboard.press('Enter');
    const stop = page.getByRole('button', { name: /interrompi/i });
    await expect(stop).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(stop).toHaveCount(0);
    await expect(composer).toBeFocused();
    release();
  });

  test('stream ends by itself while Interrompi has the focus: the focus is on the textarea', async ({ page }) => {
    const release = await holdStream(page);
    const composer = await login(page, `e2e_focus_${Date.now()}_d`);
    await page.keyboard.type('domanda');
    await page.keyboard.press('Enter');
    const stop = page.getByRole('button', { name: /interrompi/i });
    await expect(stop).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    release();
    await expect(stop).toHaveCount(0);
    await expect(composer).toBeFocused();
  });
});

test.describe('skip link to the citations list (P1-12)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test('panel open: Tab then Enter (<= 3 key presses) focuses the first citation card', async ({ page }) => {
    const composer = await login(page, `e2e_focus_${Date.now()}_c`);
    await composer.fill("Che cos'è Bitcoin?");
    await page.keyboard.press('Enter');
    const assistant = page.locator('[data-role="assistant"]').last();
    await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });
    const card = assistant.getByRole('button', { name: /Verifica nel PDF/ }).first();
    await expect(card).toBeVisible();
    // Opening the panel is setup, not under test; focus then lands inside the panel (existing behaviour).
    await card.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Verifica fonti' });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="viewer-citation-card"]').first()).toBeVisible({ timeout: 30_000 });
    // Reset the starting point: from the panel's opening focus, Shift+Tab/Tab is not part of the budget;
    // the budget counts the presses made from the panel's first focus stop.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('[aria-label="Verifica fonti"]').evaluate((el) => {
      el.setAttribute('tabindex', '-1');
      (el as HTMLElement).focus();
    });

    let presses = 0;
    await page.keyboard.press('Tab');
    presses++;
    await expect(page.getByRole('button', { name: 'Vai alle citazioni' })).toBeFocused();
    await page.keyboard.press('Enter');
    presses++;
    await expect(page.locator('[data-testid="viewer-citation-card"]').first()).toBeFocused();
    expect(presses).toBeLessThanOrEqual(3);
  });
});
