import { test, expect } from '@playwright/test';

test('streaming through the proxy is not buffered: assistant text grows progressively', async ({ page }) => {
  await page.goto('/');
  await page.locator('#user_id').fill('test_user');
  await page.getByRole('button', { name: /accedi all/i }).click();

  const composer = page.getByRole('textbox').last();
  await expect(composer).toBeVisible();
  await composer.fill('Riassumi in modo dettagliato i documenti disponibili.');
  await page.getByRole('button', { name: /invia messaggio/i }).click();

  const assistant = page.locator('[data-role="assistant"]').last();
  await expect(assistant).toBeVisible({ timeout: 30_000 });

  // Sample the text length while the message is still streaming.
  const lengths = new Set<number>();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await assistant.getAttribute('data-status');
    const len = ((await assistant.textContent()) ?? '').length;
    if (status === 'streaming') lengths.add(len);
    if (status === 'completed' || status === 'error' || status === 'aborted') break;
    await page.waitForTimeout(50);
  }

  expect(
    lengths.size,
    `distinct lengths seen while streaming: ${[...lengths].join(',')}`
  ).toBeGreaterThanOrEqual(5);
});
