import { test, expect, type Page } from '@playwright/test';
import { uniqueUser } from './helpers/user';

test.use({ viewport: { width: 1280, height: 720 } });
test.describe.configure({ timeout: 150_000 });

// The backend's page_count is a mock (always 5, BE:src/dependencies.py:25); the real PDFs have 8-11 pages.
const FAR_PAGE = 5;

async function openViewer(page: Page) {
  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('pdf-continuous'));
  await page.getByRole('button', { name: /accedi all/i }).click();
  await page.getByRole('button', { name: /invia messaggio/i }).waitFor();

  const docs = await page.evaluate(async () => (await fetch('/api/documents/')).json());
  const list = (Array.isArray(docs) ? docs : docs?.documents) as Array<{ id: string; filename: string; page_count: number }>;
  expect(Array.isArray(list), `unexpected /api/documents/ response: ${JSON.stringify(docs)}`).toBe(true);
  const doc = list[0];
  expect(doc, 'backend has documents').toBeTruthy();
  const farPage = FAR_PAGE;

  const ref = (n: number, quote: string) => ({
    document_id: doc.id,
    filename: doc.filename,
    page_number: n,
    text_quote: quote,
    bounding_regions: [{ page_number: n, rects_in: [[1.5, 4.0, 3.0, 0.4]] }],
  });
  const chunks = [
    { type: 'content', delta: 'Risposta di prova.' },
    { type: 'citations', references: [ref(1, 'prima citazione sulla pagina uno'), ref(farPage, 'seconda citazione su pagina lontana')] },
  ];
  await page.route('**/api/chat/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: chunks.map((c) => JSON.stringify(c)).join('\n') + '\n',
    });
  });

  await page.getByRole('textbox').last().fill('Domanda di prova');
  await page.getByRole('button', { name: /invia messaggio/i }).click();
  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 30_000 });
  const cards = assistant.getByRole('button', { name: /Verifica nel PDF/ });
  await expect(cards).toHaveCount(2);
  return { doc, farPage, cards };
}

async function waitScrollStable(page: Page) {
  const container = page.getByRole('region', { name: 'Pagina PDF' });
  let prev = Number.NaN;
  let stable = 0;
  await expect
    .poll(
      async () => {
        const top = await container.evaluate((el) => el.scrollTop);
        stable = top === prev ? stable + 1 : 0;
        prev = top;
        return stable;
      },
      { intervals: [100], timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(3);
  return container;
}

test('text layer: page text is selectable and the overlay does not cover it', async ({ page }) => {
  const { cards } = await openViewer(page);
  await cards.first().click();
  const currentPage = page.locator('[data-testid="pdf-page"][data-page-number="1"]');
  const textLayer = currentPage.locator('.textLayer');
  await expect(textLayer).toBeVisible({ timeout: 30_000 });
  const spans = textLayer.locator('span[role="presentation"], span:not(.markedContent)');
  await expect.poll(async () => (await textLayer.innerText()).trim().length, { timeout: 30_000 }).toBeGreaterThan(0);
  await waitScrollStable(page);

  // Pick a visible span with text that does not intersect any bbox.
  const target = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[data-testid="bbox"]')].map((b) => b.getBoundingClientRect());
    const layer = document.querySelector('[data-testid="pdf-page"][data-page-number="1"] .textLayer')!;
    const container = document.querySelector('[aria-label="Pagina PDF"]')!.getBoundingClientRect();
    for (const s of layer.querySelectorAll('span')) {
      if (!s.textContent?.trim() || s.querySelector('span')) continue;
      const r = s.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) continue;
      if (r.top < container.top + 2 || r.bottom > container.bottom - 2) continue;
      const hit = boxes.some((b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top);
      if (hit) continue;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (document.elementFromPoint(x, y) !== s) continue;
      return { x, y };
    }
    return null;
  });
  expect(target, 'a text span outside the boxes is the hit target (overlay does not cover it)').not.toBeNull();
  expect(await spans.count()).toBeGreaterThan(0);

  await page.mouse.click(target!.x, target!.y, { clickCount: 3 });
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString().trim().length ?? 0))
    .toBeGreaterThan(0);
});

test('continuous scroll: citation on a distant page is scrolled into view and the current page follows', async ({ page }) => {
  const { cards, farPage } = await openViewer(page);
  expect(farPage, 'the second citation is on a different page').toBeGreaterThan(1);

  await cards.first().click();
  const nav = page.getByRole('navigation', { name: 'Pagine con regioni' });
  await expect(nav).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Pagina corrente: 1')).toBeVisible();

  await cards.nth(1).click();
  const container = await waitScrollStable(page);
  const bbox = page.locator('[data-testid="bbox"][data-active="true"]');
  await expect(bbox).toHaveCount(1);
  await expect(bbox).toBeInViewport({ timeout: 10_000 });
  await expect(page.getByText(`Pagina corrente: ${farPage}`)).toBeVisible();
  await expect(nav.locator('[aria-current="page"]')).toHaveText(`Pag. ${farPage}`);

  const c = (await container.boundingBox())!;
  const b = (await bbox.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(c.y);
  expect(b.y + b.height).toBeLessThanOrEqual(c.y + c.height);
  expect(b.x).toBeGreaterThanOrEqual(c.x);
  expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);

  // "Pagina precedente" moves the current page back by one.
  await page.getByRole('button', { name: 'Pagina precedente' }).click();
  await expect(page.getByText(`Pagina corrente: ${farPage - 1}`)).toBeVisible();
  await waitScrollStable(page);
  await expect(page.locator(`[data-testid="pdf-page"][data-page-number="${farPage - 1}"]`)).toBeInViewport();

  // Manual scroll back to the top updates the current page.
  await container.evaluate((el) => { el.scrollTop = 0; });
  await expect(page.getByText('Pagina corrente: 1')).toBeVisible({ timeout: 10_000 });
});

test('lazy rendering: only some pages of a long document are rendered', async ({ page }) => {
  const { cards } = await openViewer(page);
  await cards.first().click();
  const pages = page.locator('[data-testid="pdf-page"]');
  await expect(pages.first()).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => pages.count(), { timeout: 30_000 }).toBeGreaterThan(FAR_PAGE);
  const total = await pages.count();
  const rendered = page.locator('[data-testid="pdf-page"][data-rendered="true"]');
  await expect(rendered.first()).toBeVisible({ timeout: 30_000 });
  await waitScrollStable(page);
  const n = await rendered.count();
  expect(n, 'at least the visible page is rendered').toBeGreaterThanOrEqual(1);
  expect(n, `rendered ${n} of ${total}`).toBeLessThan(total);
});
