import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { uniqueUser } from './helpers/user';

// P2-06: WCAG 2.1 A/AA scan (serious/critical only) of login, chat and PDF viewer against the real backend.

const USER = uniqueUser('a11y');

test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 180_000 });

  test('html has lang="it"', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  });

  test('login page has no serious/critical violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#user_id')).toBeVisible();
    const bad = await collect(page, 'login');
    expect(bad, `axe violations:\n${bad}`).toBe('');
  });

  test('chat and PDF viewer have no serious/critical violations', async ({ page }) => {
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

    await assistant.getByRole('button', { name: /Verifica nel PDF/ }).first().click();
    await expect(page.getByRole('complementary', { name: 'Verifica fonti' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="bbox"]').first()).toBeVisible({ timeout: 30_000 });
    const viewerBad = await collect(page, 'viewer');
    if (viewerBad) failures.push(viewerBad);

    expect(failures, `axe violations:\n${failures.join('\n')}`).toEqual([]);
  });
});

/**
 * Scans the page with axe and returns the serious/critical violations ('' when none).
 *
 * `next dev` re-renders the page (Fast Refresh / RSC refresh) whenever the dev server recompiles, which
 * happens in the full suite because other specs trigger on-demand compilation. A scan that lands on such a
 * transient document (T027 c1: `document-title` reported although `document.title` is set a moment before
 * and after) is not a verdict on the UI. The scan is therefore re-run until it is clean or 15 s pass: a real
 * violation is deterministic and still fails, with the last report as the message.
 */
async function collect(page: Page, label: string): Promise<string> {
  let last = '';
  await expect(page).toHaveTitle(/\S/); // the metadata <title> is part of the document being scanned
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
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `[${label}] ${v.id} (${v.impact}) nodes=${v.nodes.length}\n` +
        v.nodes.map((n) => `    target=${JSON.stringify(n.target)} html=${n.html.slice(0, 140)}`).join('\n')
    )
    .join('\n');
}
