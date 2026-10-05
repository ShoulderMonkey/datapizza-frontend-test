import { test, expect, type Page } from '@playwright/test';
import { uniqueUser } from './helpers/user';


async function askWithCitations(page: Page) {
  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('layout'));
  await page.getByRole('button', { name: /accedi all/i }).click();
  const composer = page.getByRole('textbox').last();
  await expect(composer).toBeVisible();
  // On narrow viewports the sidebar is closed by default (P1-10): the overlay never covers the composer.
  const closeSidebar = page.getByRole('button', { name: 'Chiudi barra laterale' });
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(closeSidebar).toHaveCount(0);
    await expect(composer).toBeInViewport();
  }
  await composer.fill("Che cos'è Bitcoin?");
  await page.getByRole('button', { name: /invia messaggio/i }).click();
  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });
  const card = assistant.getByRole('button', { name: /Verifica nel PDF/ }).first();
  await expect(card).toBeVisible();
  return { assistant, card, composer };
}

test.describe('desktop layout (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test('PDF is a side panel, conversation stays visible/scrollable, active citation highlighted', async ({ page }) => {
    const { assistant, card, composer } = await askWithCitations(page);
    await card.click();

    const panel = page.getByRole('complementary', { name: 'Verifica fonti' });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const bbox = page.locator('[data-testid="bbox"]').first();
    await expect(bbox).toBeVisible({ timeout: 30_000 });
    await expect(bbox).toBeInViewport({ timeout: 10_000 });
    await expect(assistant).toBeInViewport();
    await expect(panel).toBeInViewport();

    // Side by side: the scrollable conversation ends where the panel begins.
    const scroller = assistant.locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
    const sBox = await scroller.boundingBox();
    const pBox = await panel.boundingBox();
    expect(sBox && pBox).toBeTruthy();
    expect(sBox!.x + sBox!.width).toBeLessThanOrEqual(pBox!.x + 1);
    expect(sBox!.width).toBeGreaterThan(300);
    expect(await scroller.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');

    // Conversation is still scrollable and the user message is reachable.
    await scroller.evaluate((el) => { el.scrollTop = 0; });
    await expect(page.locator('[data-role="user"]').first()).toBeInViewport();
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(assistant).toBeInViewport();
    await expect(composer).toBeEnabled();

    // Active citation: card aria-current and at least one active bbox on the PDF.
    await expect(card).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-testid="bbox"][data-active="true"]').first()).toBeVisible();
  });

  test('keyboard: focus moves to the panel, Escape closes it and focus returns to the card', async ({ page }) => {
    const { card } = await askWithCitations(page);
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary', { name: 'Verifica fonti' });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[aria-label="Verifica fonti"]')))
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(card).toBeFocused();
  });
});

test.describe('mobile layout (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ timeout: 180_000 });

  test('viewer is a full-screen modal dialog closable with the close button', async ({ page }) => {
    const { card } = await askWithCitations(page);
    await card.click();

    const dialog = page.getByRole('dialog', { name: 'Verifica fonti' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByRole('complementary', { name: 'Verifica fonti' })).toHaveCount(0);

    const box = await dialog.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(390 * 0.95);
    expect(box!.height).toBeGreaterThanOrEqual(844 * 0.95);

    await page.getByRole('button', { name: 'Chiudi visualizzatore' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('Escape closes the drawer and focus returns to the card', async ({ page }) => {
    const { card } = await askWithCitations(page);
    await card.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Verifica fonti' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeFocused();
  });
});
