import { test, expect } from '@playwright/test';

test('login page is visible', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Datapizza Frontend Test' })
  ).toBeVisible();
  await expect(page.locator('#user_id')).toBeVisible();
});
