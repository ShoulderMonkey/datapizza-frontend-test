import { test, expect } from '@playwright/test';
import { uniqueUser } from './helpers/user';

test.use({ viewport: { width: 1280, height: 720 } });

test('PDF viewer: bbox near the left page margin is reachable in the side-by-side layout', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('pdf-viewer-overflow'));
  await page.getByRole('button', { name: /accedi all/i }).click();

  await page.getByRole('button', { name: /invia messaggio/i }).waitFor();

  // A real document so the PDF itself comes from the real backend.
  const docs = await page.evaluate(async () => {
    const r = await fetch('/api/documents/');
    return r.json();
  });
  const list = Array.isArray(docs) ? docs : docs?.documents;
  expect(Array.isArray(list), `unexpected /api/documents/ response: ${JSON.stringify(docs)}`).toBe(true);
  const doc = list.find((d: { page_count: number }) => d.page_count >= 1);
  expect(doc, 'backend has at least one document').toBeTruthy();

  const chunks = [
    { type: 'content', delta: 'Risposta di prova.' },
    {
      type: 'citations',
      references: [
        {
          document_id: doc.id,
          filename: doc.filename,
          page_number: 1,
          text_quote: 'citazione vicino al margine sinistro',
          bounding_regions: [{ page_number: 1, rects_in: [[0.2, 5.0, 0.8, 0.3]] }],
        },
      ],
    },
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
  await expect(composer).toBeVisible();
  await composer.fill('Domanda di prova');
  await page.getByRole('button', { name: /invia messaggio/i }).click();

  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 30_000 });
  await assistant.getByText('Verifica nel PDF').first().click();

  const container = page.getByRole('region', { name: 'Pagina PDF' });
  const bbox = page.locator('[data-testid="bbox"]').first();
  await expect(bbox).toBeVisible({ timeout: 30_000 });
  await expect(bbox).toBeInViewport({ timeout: 10_000 });

  // scrollIntoView({behavior:'smooth'}) is still animating here: wait until the
  // container scrollTop is unchanged across consecutive samples before measuring.
  let prev = Number.NaN;
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const top = await container.evaluate((el) => el.scrollTop);
        stableSamples = top === prev ? stableSamples + 1 : 0;
        prev = top;
        return stableSamples;
      },
      { intervals: [100], timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(3);

  const c = (await container.boundingBox())!;
  const b = (await bbox.boundingBox())!;
  expect(b.x, `bbox.x=${b.x} must be >= container.x=${c.x}`).toBeGreaterThanOrEqual(c.x);
  expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);
  expect(b.y).toBeGreaterThanOrEqual(c.y);
  expect(b.y + b.height).toBeLessThanOrEqual(c.y + c.height);

  // With scrollLeft = 0 the whole page must be reachable: its left edge not clipped.
  await container.evaluate((el) => { el.scrollLeft = 0; });
  const cc = (await container.boundingBox())!;
  const cv = (await container.locator('canvas').first().boundingBox())!;
  expect(cv.x, `canvas.x=${cv.x} must be >= container.x=${cc.x} at scrollLeft=0`).toBeGreaterThanOrEqual(cc.x);
});
