import { test, expect } from '@playwright/test';

test('PDF viewer: no CDN requests, opens on first region page, bbox in viewport', async ({ page }) => {
  test.setTimeout(150_000);
  const cdnRequests: string[] = [];

  await page.goto('/');
  await page.locator('#user_id').fill('test_user');
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
  const citations = body
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((c) => c && c.type === 'citations')
    .flatMap((c) => c.references ?? c.data ?? []);
  expect(citations.length, 'the backend returned citations').toBeGreaterThan(0);
  const expectedPage: number = citations[0].bounding_regions[0].page_number;

  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('cdnjs.cloudflare.com') || u.includes('cdn.jsdelivr.net')) cdnRequests.push(u);
  });

  await assistant.getByText('Verifica nel PDF').first().click();

  const nav = page.getByRole('navigation', { name: 'Pagine con regioni' });
  await expect(nav).toBeVisible({ timeout: 30_000 });
  await expect(nav.locator('[aria-current="page"]')).toHaveText(`Pag. ${expectedPage}`);
  await expect(page.getByText(`Pagina corrente: ${expectedPage}`)).toBeVisible();

  const bbox = page.locator('[data-testid="bbox"]').first();
  await expect(bbox).toBeVisible({ timeout: 30_000 });
  await expect(bbox).toBeInViewport({ timeout: 10_000 });

  expect(cdnRequests, `CDN requests: ${cdnRequests.join(', ')}`).toEqual([]);
});
