import { test, expect } from '@playwright/test';
import { uniqueUser } from './helpers/user';

test.use({ viewport: { width: 1280, height: 720 } });

test('P2-08: opening a second document keeps the active card fully visible in the CITAZIONI list', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('citation-occurrence'));
  await page.getByRole('button', { name: /accedi all/i }).click();
  await page.getByRole('button', { name: /invia messaggio/i }).waitFor();

  const docs = await page.evaluate(async () => (await fetch('/api/documents/')).json());
  const list = (Array.isArray(docs) ? docs : docs?.documents) as Array<{ id: string; filename: string; page_count: number }>;
  expect(Array.isArray(list), `unexpected /api/documents/ response: ${JSON.stringify(docs)}`).toBe(true);
  const usable = list.filter((d) => d.page_count >= 1);
  expect(usable.length, 'backend has at least two documents').toBeGreaterThanOrEqual(2);
  const [docA, docB] = usable;

  const N = 8;
  const refs = [docA, docB].flatMap((d, di) =>
    Array.from({ length: N }, (_, i) => ({
      document_id: d.id,
      filename: d.filename,
      page_number: 1,
      text_quote: `citazione ${di === 0 ? 'A' : 'B'}${i} con testo abbastanza lungo da occupare piu righe nella card del viewer PDF`,
      bounding_regions: [{ page_number: 1, rects_in: [[1, 1 + i * 0.5, 2, 0.4]] }],
    }))
  );
  const chunks = [
    { type: 'content', delta: 'Risposta con molte citazioni.' },
    { type: 'citations', references: refs },
  ];
  await page.route('**/api/chat/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: chunks.map((c) => JSON.stringify(c)).join('\n') + '\n',
    });
  });

  const composer = page.getByRole('textbox').last();
  await composer.fill('Domanda di prova');
  await page.getByRole('button', { name: /invia messaggio/i }).click();

  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 30_000 });

  const cards = assistant.getByTestId('citation-card');
  await expect(cards).toHaveCount(2 * N);
  await cards.nth(0).click();
  const bbox = page.getByTestId('bbox').first();
  await expect(bbox).toBeVisible({ timeout: 30_000 });
  await bbox.click();

  const target = cards.nth(N + 5);
  await target.scrollIntoViewIfNeeded();
  await target.click();

  const viewerList = page.getByTestId('viewer-citation-card').first().locator('xpath=..');
  const scrollable = await viewerList.evaluate((el) => el.scrollHeight > el.clientHeight + 20);
  expect(scrollable, 'CITAZIONI list must overflow for the test to be meaningful').toBe(true);
  const active = viewerList.locator('[aria-current="true"]');
  await expect(active).toHaveCount(1, { timeout: 30_000 });
  await expect(active).toContainText('B5');
  await expect(async () => {
    const l = (await viewerList.boundingBox())!;
    const a = (await active.boundingBox())!;
    expect(a.y, `card.y=${a.y} >= list.y=${l.y}`).toBeGreaterThanOrEqual(l.y - 1);
    expect(a.y + a.height, `card bottom ${a.y + a.height} <= list bottom ${l.y + l.height}`).toBeLessThanOrEqual(l.y + l.height + 1);
  }).toPass({ timeout: 3_000 });
  // let any late layout settle, then re-check
  await page.waitForTimeout(800);
  const l = (await viewerList.boundingBox())!;
  const a = (await active.boundingBox())!;
  expect(a.y).toBeGreaterThanOrEqual(l.y - 1);
  expect(a.y + a.height).toBeLessThanOrEqual(l.y + l.height + 1);
});
