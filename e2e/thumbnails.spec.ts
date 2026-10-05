import { test, expect } from '@playwright/test';
import { uniqueUser } from './helpers/user';

// P2-02: lazy citation thumbnails share one download per document_id with the PDF viewer (real backend).

test('thumbnails download at most one PDF per distinct document_id, also when opening the viewer', async ({ page }) => {
  test.setTimeout(180_000);
  const fileGets: string[] = [];
  page.on('request', (req) => {
    const m = req.url().match(/\/api\/documents\/([^/]+)\/file/);
    if (m && req.method() === 'GET') fileGets.push(decodeURIComponent(m[1]));
  });

  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('thumbnails'));
  await page.getByRole('button', { name: /accedi all/i }).click();
  const composer = page.getByRole('textbox').last();
  await expect(composer).toBeVisible();

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/chat') && r.request().method() === 'POST',
    { timeout: 60_000 }
  );
  await composer.fill("Che cos'è Bitcoin?");
  await page.getByRole('button', { name: /invia messaggio/i }).click();
  const response = await responsePromise;
  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });

  const body = await response.text();
  const refs: { document_id: string }[] = body
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((c) => c && c.type === 'citations')
    .flatMap((c) => c.references ?? []);
  expect(refs.length, 'the backend returned citations').toBeGreaterThanOrEqual(3);
  const distinct = new Set(refs.map((r) => r.document_id));

  const cards = assistant.getByTestId('citation-card');
  await expect(cards).toHaveCount(refs.length);
  // Scroll every card into view so each lazy thumbnail intersects.
  for (let i = 0; i < refs.length; i++) await cards.nth(i).scrollIntoViewIfNeeded();
  const thumbs = assistant.getByTestId('citation-thumbnail');
  for (let i = 0; i < refs.length; i++) {
    await thumbs.nth(i).scrollIntoViewIfNeeded();
    await expect(thumbs.nth(i)).toHaveAttribute('data-state', 'rendered', { timeout: 60_000 });
  }
  expect(assistant.getByTestId('thumbnail-rect').first()).toBeVisible();

  expect(new Set(fileGets).size, `downloaded ids: ${fileGets}`).toBe(distinct.size);
  expect(fileGets.length, `GETs: ${fileGets}`).toBeLessThanOrEqual(distinct.size);

  // Opening the viewer from a card of an already downloaded document must not download again.
  await cards.first().click();
  await expect(page.locator('[data-testid="bbox"]').first()).toBeVisible({ timeout: 30_000 });
  expect(fileGets.length, `GETs after opening the viewer: ${fileGets}`).toBeLessThanOrEqual(distinct.size);
});
