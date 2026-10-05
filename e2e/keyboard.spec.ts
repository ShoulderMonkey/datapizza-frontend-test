import { test, expect, type FileChooser, type Page } from '@playwright/test';
import path from 'node:path';
import { uniqueUser } from './helpers/user';

// Keyboard-only journey against the real backend. Forbidden here: click(), mouse.*, dispatchEvent('click').
// focus() is used only once, to give the page its first focus target, see `focusFirstField`.

const PDF = path.resolve(__dirname, '../../test-tecnico-frontend-engineer/backend/data/pdfs/bitcoin.pdf');

/** Accessible-ish label of the focused element: aria-label, then text, then title. */
const activeLabel = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return '';
    return el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.id || '';
  });

/** Presses Tab until the focused element's label matches; returns how many presses it took. */
async function tabTo(page: Page, label: RegExp, max = 60, key = 'Tab'): Promise<number> {
  for (let n = 1; n <= max; n++) {
    await page.keyboard.press(key);
    if (label.test((await activeLabel(page)).trim())) return n;
  }
  throw new Error(`Tab did not reach ${label} within ${max} presses; last focus: ${await activeLabel(page)}`);
}

test.describe('keyboard-only journey (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 240_000 });

  test('login, upload, ask, open citation and close it without a mouse', async ({ page }) => {
    const tabCounts: Record<string, number> = {};

    // Subscribe to the file chooser from the start. Playwright enables the dialog interception asynchronously
    // when a listener is added: a `waitForEvent('filechooser')` created right before `keyboard.press('Enter')`
    // can lose that race, the native dialog opens instead and no event arrives (T027 c1: the page log showed the
    // trusted Enter keydown and the input.click() dispatched correctly, yet no chooser was reported).
    const chooserPromise = new Promise<FileChooser>((resolve) => page.once('filechooser', resolve));

    // Login: Tab until the user id field, type, Enter submits the form.
    await page.goto('/');
    await expect(page.locator('#user_id')).toBeVisible();
    // focus() is unavoidable here only if the field is not auto-focused: Tab reaches it otherwise.
    tabCounts.login = await tabTo(page, /user_id|user id/i, 5).catch(async () => {
      await page.locator('#user_id').focus(); // documented fallback: first focus target
      return 0;
    });
    await expect(page.locator('#user_id')).toBeFocused();
    await page.keyboard.type(uniqueUser('kbd'));
    await page.keyboard.press('Enter');
    const composer = page.getByRole('textbox', { name: 'Domanda sui documenti' });
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();

    // Open documents modal: the sidebar button comes before the composer in DOM order (Shift+Tab).
    tabCounts.openDocuments = await tabTo(page, /^documenti pdf/i, 40, 'Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Libreria Documenti PDF' })).toBeVisible();

    // Upload tab, dropzone (role=button) -> Enter opens the file chooser.
    tabCounts.uploadTab = await tabTo(page, /carica nuovi pdf/i);
    await page.keyboard.press('Enter');
    const dropzone = page.getByRole('button', { name: 'Scegli i documenti PDF da caricare' });
    await expect(dropzone).toBeVisible();
    tabCounts.dropzone = await tabTo(page, /scegli i documenti pdf/i);
    await expect(dropzone).toBeFocused();
    await page.keyboard.press('Enter');
    const chooser = await chooserPromise; // bounded by the test timeout; the event comes from the Enter above
    await chooser.setFiles(PDF);
    await expect(page.getByText('File selezionati (1)')).toBeVisible();
    tabCounts.uploadSubmit = await tabTo(page, /carica 1 file/i);
    await page.keyboard.press('Enter');
    await expect(page.getByText(/caricat/i).first()).toBeVisible({ timeout: 60_000 });

    // Close documents.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Libreria Documenti PDF' })).toHaveCount(0);

    // Ask: reach the composer by keyboard, type, Enter.
    tabCounts.composer = await tabTo(page, /domanda sui documenti/i, 80);
    await expect(composer).toBeFocused();
    // The backend sample is random and may not cite one document on 2 distinct pages (needed to select a
    // second citation in the viewer list): ask again, by keyboard, up to 6 times.
    let assistant = page.locator('[data-role="assistant"]').last();
    let repeated: string | undefined;
    let cards: string[] = [];
    for (let attempt = 1; attempt <= 6 && !repeated; attempt++) {
      await expect(composer).toBeFocused();
      await page.keyboard.type("Che cos'è Bitcoin?");
      await page.keyboard.press('Enter');
      await expect(composer).toBeFocused(); // focus is not lost during the stream
      await expect(page.getByRole('log')).toHaveAttribute('aria-busy', 'true');
      assistant = page.locator('[data-role="assistant"]').last();
      await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });
      await expect(page.getByRole('log')).toHaveAttribute('aria-busy', 'false');
      await expect(composer).toBeFocused(); // not stolen at the end of the stream
      await expect(assistant.getByRole('button', { name: /Verifica nel PDF/ }).first()).toBeVisible();
      cards = await assistant
        .getByRole('button', { name: /Verifica nel PDF/ })
        .evaluateAll((els) =>
          els.map((e) => {
            const [name, page] = (e as HTMLElement).innerText.split('\n');
            return `${name.trim()}|${page.trim()}`;
          })
        );
      const pagesByDoc = new Map<string, Set<string>>();
      for (const c of cards) {
        const [n, pg] = c.split('|');
        pagesByDoc.set(n, (pagesByDoc.get(n) ?? new Set()).add(pg));
      }
      repeated = [...pagesByDoc].find(([, pages]) => pages.size >= 2)?.[0];
    }
    expect(repeated, `no document cited on 2 distinct pages in ${cards.join(', ')}`).toBeTruthy();
    // Messages precede the composer in DOM order: Shift+Tab walks back from the composer to the cards.
    const esc = repeated!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    tabCounts.citationBackwards = await tabTo(page, new RegExp(`^${esc}\\nPag\\. \\d+\\n[\\s\\S]*Verifica nel PDF$`), 80, 'Shift+Tab');
    const opened = await page.evaluateHandle(() => document.activeElement as HTMLElement);
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Verifica fonti' });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[aria-label="Verifica fonti"]')))
      .toBe(true);

    // Keyboard equivalent of the bboxes (tabIndex=-1): the CITAZIONI list buttons inside the panel.
    const list = panel.getByRole('button', { name: /^Pagina \d+/ });
    await expect(page.locator('[data-testid="bbox"][data-active="true"]').first()).toBeVisible({ timeout: 30_000 });
    expect(await list.count()).toBeGreaterThan(1);
    // The backend may return duplicate citations (same document, page and quote): they share the selection
    // by design (isSameCitation), so the target is the first entry whose text differs from the current one.
    // Identity key = page, quote, document: without the "Vai a pagina/Evidenziato" footer and without the
    // "N boxes" line (the box count is not part of isSameCitation, and duplicates may differ in it).
    const citationKey = (raw: string) =>
      raw
        .split('\n')
        .slice(0, -1)
        .filter((l) => !/^\d+ boxes?$/.test(l.trim()))
        .join('\n');
    const texts = (await list.evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText))).map(citationKey);
    const currentIdx = await list.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-current') === 'true'));
    expect(currentIdx).toBeGreaterThanOrEqual(0);
    const targetIdx = texts.findIndex((t) => t !== texts[currentIdx]);
    expect(targetIdx, 'no citation with a distinct text to select').toBeGreaterThanOrEqual(0);
    const target = list.nth(targetIdx);
    let toList = 0;
    for (; toList < 40; toList++) {
      await page.keyboard.press('Tab');
      if (await target.evaluate((el) => el === document.activeElement)) break;
    }
    expect(toList, 'citation list button not reached by Tab').toBeLessThan(40);
    tabCounts.panelToCitationList = toList + 1;
    await page.keyboard.press('Enter');
    await expect(target).toHaveAttribute('aria-current', 'true');
    await expect(list.nth(currentIdx)).not.toHaveAttribute('aria-current', 'true');
    const selected = (
      await list.evaluateAll((els) =>
        els.filter((e) => e.getAttribute('aria-current') === 'true').map((e) => (e as HTMLElement).innerText)
      )
    ).map(citationKey);
    expect(selected.length).toBeGreaterThan(0);
    expect(new Set(selected)).toEqual(new Set([texts[targetIdx]]));
    await expect(page.locator('[data-testid="bbox"][data-active="true"]').first()).toBeVisible({ timeout: 30_000 });
    console.log('TAB COUNTS', JSON.stringify(tabCounts));

    // Close the viewer with Escape; focus goes back to the card.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect
      .poll(() => opened.evaluate((el) => el === document.activeElement))
      .toBe(true); // focus returns to the card that opened the viewer
  });
});
