import { test, expect, type Page } from '@playwright/test';

const Q1 = "Che cos'è Bitcoin?";
const Q2 = 'Come funziona la blockchain?';

const uniqueUser = () => `e2e_hist_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const entries = (page: Page) => page.locator('[data-testid="history-entry"]');

/** Message text without the header (role label + time), which differs between live and stored rendering. */
const bodyOf = (text: string | null) => (text ?? '').replace(/^\s*Assistente\s*\d{1,2}:\d{2}(\s*[AP]M)?/i, '').trim();

async function login(page: Page, userId: string) {
  await page.goto('/');
  await page.locator('#user_id').fill(userId);
  await page.getByRole('button', { name: /accedi all/i }).click();
  await expect(page.getByRole('textbox').last()).toBeVisible();
}

async function ask(page: Page, question: string) {
  const composer = page.getByRole('textbox').last();
  await expect(composer).toBeEnabled({ timeout: 90_000 });
  await composer.fill(question);
  await page.getByRole('button', { name: /invia messaggio/i }).click();
  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toHaveAttribute('data-status', 'completed', { timeout: 90_000 });
  return assistant;
}

test.describe('history model', () => {
  test.describe.configure({ timeout: 240_000 });

  test('two questions create two entries, most recent on top', async ({ page }) => {
    await login(page, uniqueUser());
    await expect(entries(page)).toHaveCount(0);

    await ask(page, Q1);
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page).first()).toContainText(Q1);

    await ask(page, Q2);
    await expect(entries(page)).toHaveCount(2);
    await expect(entries(page).first()).toContainText(Q2);
    await expect(entries(page).nth(1)).toContainText(Q1);
  });

  test('selecting an entry shows Q/A and citations, the PDF opens, and a new question leaves the entry untouched', async ({ page }) => {
    await login(page, uniqueUser());
    const liveAssistant = await ask(page, Q1);
    const answerText = bodyOf(await liveAssistant.textContent());
    expect(answerText.length).toBeGreaterThan(0);
    await expect(entries(page)).toHaveCount(1);

    // Start from a clean view, then select the stored entry.
    await page.getByRole('button', { name: /nuova conversazione/i }).click();
    await expect(page.locator('[data-role="assistant"]')).toHaveCount(0);
    await entries(page).first().click();

    await expect(entries(page).first()).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-role="user"]').last()).toContainText(Q1);
    const stored = page.locator('[data-role="assistant"]').last();
    await expect(stored).toHaveAttribute('data-status', 'completed');
    await expect(stored.getByText('Documenti correlati')).toBeVisible();
    await expect(page.getByTestId('history-entry-notice')).toBeVisible();

    await stored.getByText('Verifica nel PDF').first().click();
    const bbox = page.locator('[data-testid="bbox"]').first();
    await expect(bbox).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Chiudi visualizzatore' }).click();
    await expect(bbox).toHaveCount(0);

    // New question while the entry is selected: +1 entry, selection cleared, entry unchanged.
    await ask(page, Q2);
    await expect(entries(page)).toHaveCount(2);
    await expect(entries(page).first()).toContainText(Q2);
    // ADR 0007: the entry just saved is the active one, A is not; the saving is announced.
    await expect(entries(page).first()).toHaveAttribute('aria-current', 'true');
    await expect(entries(page).nth(1)).not.toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('status').filter({ hasText: 'Conversazione salvata nello storico' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Dalla conversazione precedente' })).toBeVisible();
    await expect(page.getByTestId('history-entry-notice')).toHaveCount(0);

    await entries(page).nth(1).click();
    await expect(entries(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-role="user"]')).toHaveCount(1);
    await expect(page.locator('[data-role="user"]').first()).toContainText(Q1);
    const reread = page.locator('[data-role="assistant"]');
    await expect(reread).toHaveCount(1);
    await expect(reread.first()).toHaveAttribute('data-status', 'completed');
    expect(bodyOf(await reread.first().textContent())).toContain(answerText.slice(0, 60));
  });
});
