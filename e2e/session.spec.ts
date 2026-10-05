import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('#user_id').fill('test_user');
  await page.getByRole('button', { name: /accedi all/i }).click();
  await expect(page.getByRole('button', { name: /libreria documenti|documenti pdf/i }).first()).toBeVisible();
  // Initial lists loaded (document count badge and history section), so no fetch is in flight later.
  await expect(page.getByRole('button', { name: /^documenti pdf\s*\d+$/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/cronologia chat \(\d+\)/i)).toBeVisible({ timeout: 15_000 });
}

test('reload while logged in: no hydration errors and the workspace is visible', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (m) => messages.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`));

  await login(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /libreria documenti|documenti pdf/i }).first()).toBeVisible();
  await expect(page.getByRole('textbox').last()).toBeVisible();

  const bad = messages.filter((t) => /hydrat|did not match/i.test(t));
  expect(bad, bad.join('\n')).toEqual([]);
});

test('cookie cleared: opening documents shows the login with the expired-session message', async ({ page, context }) => {
  await login(page);
  await context.clearCookies();
  await page.getByRole('button', { name: /libreria documenti|documenti pdf/i }).first().click();

  await expect(page.getByRole('alert').filter({ hasText: 'Sessione scaduta, accedi di nuovo' })).toBeVisible();
  await expect(page.locator('#user_id')).toBeVisible();
  await expect(page.getByText(/errore generico|something went wrong/i)).toHaveCount(0);
});
