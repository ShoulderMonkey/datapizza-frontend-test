import { test, expect, type Page } from '@playwright/test';
import { uniqueUser } from './helpers/user';


async function openViewer(page: Page) {
  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('resp'));
  await page.getByRole('button', { name: /accedi all/i }).click();
  const composer = page.getByRole('textbox', { name: 'Domanda sui documenti' });
  await expect(composer).toBeVisible();
  await composer.fill("Che cos'è Bitcoin?");
  await page.getByRole('button', { name: /invia messaggio/i }).click();
  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });
  await assistant.getByRole('button', { name: /Verifica nel PDF/ }).first().click();
  const pageRegion = page.getByRole('region', { name: 'Pagina PDF' });
  await expect(pageRegion).toBeVisible({ timeout: 30_000 });
  const canvas = pageRegion.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="bbox"]').first()).toBeVisible({ timeout: 30_000 });
  // Let the fit-to-width re-render settle.
  await page.waitForTimeout(500);
  return { composer, pageRegion, canvas };
}

for (const width of [390, 768]) {
  test.describe(`fit-to-width drawer (${width}px)`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 180_000 });

    test('no horizontal scroll, canvas fits the PDF page container', async ({ page }) => {
      const { pageRegion, canvas } = await openViewer(page);
      const doc = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(doc.sw).toBeLessThanOrEqual(doc.cw);
      const region = await pageRegion.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
      expect(region.sw).toBeLessThanOrEqual(region.cw);
      const cBox = await canvas.boundingBox();
      const rBox = await pageRegion.boundingBox();
      expect(cBox!.width).toBeGreaterThan(100);
      expect(cBox!.width).toBeLessThanOrEqual(rBox!.width);
    });
  });
}

for (const width of [1440, 1024]) {
  test.describe(`desktop with viewer open (${width}px)`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.describe.configure({ timeout: 180_000 });

    test('composer placeholder is fully visible', async ({ page }) => {
      const { composer } = await openViewer(page);
      await composer.fill('');
      const m = await composer.evaluate((el) => {
        const t = el as HTMLTextAreaElement;
        const cs = getComputedStyle(t);
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const usable = t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return {
          placeholder: t.placeholder,
          textWidth: ctx.measureText(t.placeholder).width,
          usable,
          sw: t.scrollWidth,
          cw: t.clientWidth,
        };
      });
      expect(m.placeholder.length).toBeGreaterThan(0);
      expect(m.sw).toBeLessThanOrEqual(m.cw);
      expect(m.textWidth).toBeLessThanOrEqual(m.usable);
    });
  });
}

test.describe('conversation width (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test('conversation column is at least 480px with sidebar and viewer open', async ({ page }) => {
    await openViewer(page);
    await expect(page.getByRole('complementary', { name: 'Verifica fonti' })).toBeVisible();
    const box = await page.locator('main').first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(480);
  });
});
