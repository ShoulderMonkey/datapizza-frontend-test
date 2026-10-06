import { test, expect, type Page } from '@playwright/test';
import { uniqueUser } from './helpers/user';

async function login(page: Page, userId: string) {
  await page.goto('/');
  await page.locator('#user_id').fill(userId);
  await page.getByRole('button', { name: /accedi all/i }).click();
  await expect(page.getByText(userId, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test('login as x2 in tab 2: tab 1 no longer shows x1 (no reload)', async ({ context }) => {
  const x1 = uniqueUser('tab1');
  const x2 = uniqueUser('tab2');
  const page1 = await context.newPage();
  await login(page1, x1);

  const page2 = await context.newPage();
  await page2.goto('/');
  await expect(page2.getByText(x1, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await page2.getByRole('button', { name: /esci/i }).click();
  await expect(page2.locator('#user_id')).toBeVisible();
  await page2.locator('#user_id').fill(x2);
  await page2.getByRole('button', { name: /accedi all/i }).click();
  await expect(page2.getByText(x2, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  await expect(page1.getByText(x1, { exact: true })).toHaveCount(0, { timeout: 10_000 });
});

test('logout in tab 2: tab 1 shows the login form (no reload)', async ({ context }) => {
  const x1 = uniqueUser('tab1');
  const page1 = await context.newPage();
  await login(page1, x1);

  const page2 = await context.newPage();
  await page2.goto('/');
  await page2.getByRole('button', { name: /esci/i }).click();
  await expect(page2.locator('#user_id')).toBeVisible();

  await expect(page1.locator('#user_id')).toBeVisible({ timeout: 10_000 });
});
