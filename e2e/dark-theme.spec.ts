import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { uniqueUser } from './helpers/user';

// P2-07: dark theme (prefers-color-scheme: dark) must have a dark page background and WCAG AA text contrast.

const USER = uniqueUser('dark');
// Relative luminance (WCAG) below which a background counts as "dark".
const DARK_LUMINANCE_MAX = 0.2;

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test('body has an explicit dark background', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#user_id')).toBeVisible();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const rgba = parseColor(bg);
    // Transparent body = no explicit dark background = failure.
    expect(rgba.a, `body background is transparent: ${bg}`).toBeGreaterThan(0.99);
    expect(luminance(rgba), `body background ${bg} is not dark`).toBeLessThan(DARK_LUMINANCE_MAX);
  });

  test('login has no color-contrast violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#user_id')).toBeVisible();
    const bad = await collect(page, 'login');
    expect(bad, `color-contrast violations:\n${bad}`).toBe('');
  });

  test('chat, documents modal and PDF viewer have no color-contrast violations', async ({ page }) => {
    await page.goto('/');
    await page.locator('#user_id').fill(USER);
    await page.getByRole('button', { name: /accedi all/i }).click();
    const composer = page.getByRole('textbox', { name: 'Domanda sui documenti' });
    await expect(composer).toBeVisible();
    await composer.fill("Che cos'è Bitcoin?");
    await page.getByRole('button', { name: /invia messaggio/i }).click();
    const assistant = page.locator('[data-role="assistant"]').last();
    await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });
    await expect(assistant.getByRole('button', { name: /Verifica nel PDF/ }).first()).toBeVisible();

    const failures: string[] = [];
    const chatBad = await collect(page, 'chat');
    if (chatBad) failures.push(chatBad);

    await page.getByRole('button', { name: /libreria documenti|documenti pdf/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const modalBad = await collect(page, 'documents-modal');
    if (modalBad) failures.push(modalBad);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await assistant.getByRole('button', { name: /Verifica nel PDF/ }).first().click();
    await expect(page.getByRole('complementary', { name: 'Verifica fonti' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="bbox"]').first()).toBeVisible({ timeout: 30_000 });
    const viewerBad = await collect(page, 'viewer');
    if (viewerBad) failures.push(viewerBad);

    expect(failures, `color-contrast violations:\n${failures.join('\n')}`).toEqual([]);
  });

  // P2-10: upload states (error alert and in-progress button) in dark mode.
  const MINIMAL_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
  );

  async function openUploadWithFile(page: Page, user: string) {
    await page.goto('/');
    await page.locator('#user_id').fill(user);
    await page.getByRole('button', { name: /accedi all/i }).click();
    await expect(page.getByRole('button', { name: /invia messaggio/i })).toBeVisible();
    await page.getByRole('button', { name: /libreria pdf/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /carica nuovi pdf/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'non-ammesso.pdf',
      mimeType: 'application/pdf',
      buffer: MINIMAL_PDF,
    });
  }

  test('upload error state has no color-contrast violations', async ({ page }) => {
    await openUploadWithFile(page, uniqueUser('dark_err'));
    await page.getByRole('button', { name: /carica 1 file/i }).click();
    await expect(page.getByText(/«non-ammesso\.pdf»/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Errore caricamento:')).toBeVisible();
    const bad = await collect(page, 'upload-error');
    expect(bad, `color-contrast violations:\n${bad}`).toBe('');
  });

  test('upload in progress state has no color-contrast violations', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/documents/', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await gate;
      await route.fallback();
    });
    await openUploadWithFile(page, uniqueUser('dark_up'));
    await page.getByRole('button', { name: /carica 1 file/i }).click();
    await expect(page.getByRole('button', { name: 'Annulla' })).toBeVisible();
    await expect(page.getByText('Caricamento in corso...')).toBeVisible();
    const bad = await collect(page, 'upload-in-progress');
    release();
    expect(bad, `color-contrast violations:\n${bad}`).toBe('');
  });
});

function parseColor(css: string): { r: number; g: number; b: number; a: number } {
  const m = css.match(/rgba?\(([^)]+)\)/) ?? css.match(/color\(srgb ([^)]+)\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 0 }; // unparseable / 'transparent'
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const scale = css.startsWith('color(') ? 255 : 1;
  return { r: parts[0] * scale, g: parts[1] * scale, b: parts[2] * scale, a: parts[3] ?? 1 };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Runs axe `color-contrast` (re-scanned for up to 15 s to absorb dev-server re-renders); '' when clean. */
async function collect(page: Page, label: string): Promise<string> {
  let last = '';
  await expect(page).toHaveTitle(/\S/);
  try {
    await expect
      .poll(
        async () => {
          last = await scan(page, label);
          return last;
        },
        { intervals: [0, 250, 500, 1_000], timeout: 15_000 }
      )
      .toBe('');
  } catch {
    return last;
  }
  return '';
}

async function scan(page: Page, label: string): Promise<string> {
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  return results.violations
    .map(
      (v) =>
        `[${label}] ${v.id} nodes=${v.nodes.length}\n` +
        v.nodes
          .map((n) => {
            const d = (n.any[0]?.data ?? {}) as { contrastRatio?: number; fgColor?: string; bgColor?: string };
            return `    target=${JSON.stringify(n.target)} ratio=${d.contrastRatio} fg=${d.fgColor} bg=${d.bgColor}`;
          })
          .join('\n')
    )
    .join('\n');
}
