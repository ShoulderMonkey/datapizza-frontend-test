import { test, expect, type Locator } from '@playwright/test';
import { uniqueUser } from './helpers/user';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

for (const width of [1024, 1440]) {
test(`P2-09: at ${width}px with sidebar and viewer open, related cards and header do not overlap and links are clickable`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 800 });

  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser("related"));
  await page.getByRole('button', { name: /accedi all/i }).click();
  await page.getByRole('button', { name: /invia messaggio/i }).waitFor();

  const docs = await page.evaluate(async () => (await fetch('/api/documents/')).json());
  const list = (Array.isArray(docs) ? docs : docs?.documents) as Array<{ id: string; filename: string; page_count: number }>;
  const usable = list.filter((d) => d.page_count >= 1);
  expect(usable.length, 'backend has at least two documents').toBeGreaterThanOrEqual(2);

  const refs = Array.from({ length: 6 }, (_, i) => {
    const d = usable[i % usable.length];
    return {
      document_id: d.id,
      filename: d.filename,
      page_number: 1,
      text_quote: `citazione ${i} con testo abbastanza lungo da occupare piu righe nella card`,
      bounding_regions: [{ page_number: 1, rects_in: [[1, 1 + i * 0.5, 2, 0.4]] }],
    };
  });
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

  await page.getByRole('textbox').last().fill('Domanda di prova molto lunga per rendere il titolo della chat più largo dello spazio disponibile nella testata');
  await page.getByRole('button', { name: /invia messaggio/i }).click();
  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Chiudi barra laterale' })).toBeVisible();

  const cards = assistant.getByTestId('citation-card');
  expect(await cards.count()).toBeGreaterThanOrEqual(4);
  await cards.first().getByText('Verifica nel PDF').click();
  await expect(page.getByRole('complementary', { name: 'Verifica fonti' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('bbox').first()).toBeVisible({ timeout: 30_000 });

  // The "Libreria PDF" button keeps its accessible name even when the label is visually hidden.
  await expect(page.getByRole('button', { name: /libreria pdf/i })).toBeVisible();

  // Viewer toolbar: every button (close included) fully inside the viewport and the viewer panel.
  const panel = page.getByRole('complementary', { name: 'Verifica fonti' });
  const pBox = (await panel.boundingBox())!;
  const viewport = page.viewportSize()!;
  const close = page.getByRole('button', { name: 'Chiudi visualizzatore' });
  await expect(close).toBeVisible();
  const toolbarButtons: { name: string; box: Box }[] = await panel.getByRole('button').evaluateAll((els) =>
    els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '', box: { x: r.x, y: r.y, width: r.width, height: r.height } };
      })
      .filter((b) => b.box.width > 0 && b.box.y < 160)
  );
  expect(toolbarButtons.length).toBeGreaterThanOrEqual(3);
  for (const { name, box } of toolbarButtons) {
    const where = `"${name}" ${JSON.stringify(box)} viewport ${viewport.width}, panel x ${pBox.x} w ${pBox.width}`;
    expect(box.x, where).toBeGreaterThanOrEqual(pBox.x - 0.5);
    expect(box.x + box.width, where).toBeLessThanOrEqual(Math.min(viewport.width, pBox.x + pBox.width) + 0.5);
  }
  const cb = (await close.boundingBox())!;
  expect(cb.x + cb.width, 'close button inside the viewport').toBeLessThanOrEqual(viewport.width + 0.5);

  // Positions in the scroll container's content frame (independent of the current scrollTop).
  const frame: Box[] = await cards.evaluateAll((els) => {
    const sc = els[0].closest('.overflow-y-auto') as HTMLElement;
    const base = sc.getBoundingClientRect();
    return els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x - base.x, y: r.y - base.y + sc.scrollTop, width: r.width, height: r.height };
    });
  });
  const scrollerWidth = await cards.first().evaluate((el) => (el.closest('.overflow-y-auto') as HTMLElement).clientWidth);
  for (const [i, f] of frame.entries()) {
    expect(f.x, `card ${i} starts inside the conversation`).toBeGreaterThanOrEqual(-0.5);
    expect(f.x + f.width, `card ${i} ends inside the conversation (${scrollerWidth}px)`).toBeLessThanOrEqual(scrollerWidth + 0.5);
  }
  // The conversation column is what is left of the viewport at the left of the viewer panel:
  // a card wider than it is hidden under the viewer.
  const panelX = (await page.getByRole('complementary', { name: 'Verifica fonti' }).boundingBox())!.x;
  const cardsRight: number[] = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
  // Everything in a card (thumbnail, quote box, badges, link) must stay inside the card box.
  const spills: string[] = await cards.evaluateAll((els) =>
    els.flatMap((el, i) => {
      const card = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll('*'))
        .filter((d) => d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().right > card.right + 0.5)
        .map((d) => `card ${i}: <${d.tagName.toLowerCase()} "${(d.textContent ?? "").slice(0, 30)}"> right ${d.getBoundingClientRect().right} > ${card.right}`);
    })
  );
  expect(spills, spills.join('\n')).toEqual([]);
  const leftSpills: string[] = await cards.evaluateAll((els) =>
    els.flatMap((el, i) => {
      const card = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll('*'))
        .filter((d) => d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().left < card.left - 0.5)
        .map((d) => `card ${i}: <${d.tagName.toLowerCase()}> left ${d.getBoundingClientRect().left} < ${card.left}`);
    })
  );
  expect(leftSpills, leftSpills.join('\n')).toEqual([]);
  // Wide enough card (>= 344px): thumbnail and quote on the same row.
  for (let i = 0; i < frame.length; i++) {
    if (frame[i].width < 344) continue;
    const card = cards.nth(i);
    const thumb = (await card.getByTestId('citation-thumbnail').boundingBox())!;
    const quote = (await card.locator('.italic').boundingBox())!;
    expect(quote.y, `card ${i} (${frame[i].width}px): quote top ${quote.y} < thumbnail bottom ${thumb.y + thumb.height}`).toBeLessThan(thumb.y + thumb.height);
    expect(quote.x, `card ${i}: quote beside the thumbnail`).toBeGreaterThanOrEqual(thumb.x + thumb.width - 0.5);
  }
  cardsRight.forEach((right, i) => expect(right, `card ${i} right edge ${right} vs viewer left ${panelX}`).toBeLessThanOrEqual(panelX + 0.5));
  for (let i = 0; i < frame.length; i++) {
    for (let j = i + 1; j < frame.length; j++) {
      expect(overlaps(frame[i], frame[j]), `cards ${i} and ${j} overlap: ${JSON.stringify([frame[i], frame[j]])}`).toBe(false);
    }
  }

  // Header: title and "Libreria PDF" button side by side, never overlapping.
  const header = page.locator('header').filter({ has: page.locator('h2') }).first();
  const title = header.locator('h2');
  const libButton = header.getByRole('button').last();
  const tBox = (await title.boundingBox())!;
  const bBox = (await libButton.boundingBox())!;
  const hBox = (await header.boundingBox())!;
  expect(bBox.x + bBox.width, 'button inside the header').toBeLessThanOrEqual(hBox.x + hBox.width + 0.5);
  // The visible end of the title: its box when it clips (ellipsis), otherwise where the text really ends.
  const titleEnd = await title.evaluate((h) => {
    const clips = getComputedStyle(h).overflow !== 'visible';
    if (clips) return h.getBoundingClientRect().right;
    const range = document.createRange();
    range.selectNodeContents(h.querySelector('span') ?? h);
    return range.getBoundingClientRect().right;
  });
  expect(titleEnd, `title ends at ${titleEnd}, button starts at ${bBox.x}`).toBeLessThanOrEqual(bBox.x + 0.5);
  expect(overlaps(tBox, bBox), `header title ${JSON.stringify(tBox)} vs button ${JSON.stringify(bBox)}`).toBe(false);

  // "Verifica nel PDF" links are clickable: topmost element at their centre is the link itself.
  const links = cards.getByText('Verifica nel PDF');
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(4);
  const hitOk = async (link: Locator) =>
    link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!top && (top === el || el.contains(top));
    });
  for (let i = 0; i < count; i++) {
    await links.nth(i).scrollIntoViewIfNeeded();
    expect(await hitOk(links.nth(i)), `link ${i} is covered by another element`).toBe(true);
  }

  // Clicking another card's link moves the viewer to it.
  const last = links.nth(count - 1);
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(cards.nth(count - 1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('complementary', { name: 'Verifica fonti' })).toBeVisible();
  await expect(page.getByTestId('bbox').first()).toBeVisible({ timeout: 30_000 });
});
}
