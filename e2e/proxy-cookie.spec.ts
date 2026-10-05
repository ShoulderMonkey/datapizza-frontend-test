import { test, expect } from '@playwright/test';
import { uniqueUser } from './helpers/user';

test('login via same-origin proxy sets the user_id cookie and authenticated calls succeed', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('#user_id').fill(uniqueUser('proxy-cookie'));

  const loginResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /accedi all/i }).click();
  const login = await loginResponse;
  expect(login.status()).toBe(200);
  expect(new URL(login.url()).origin).toBe(new URL(page.url()).origin);

  const cookies = await context.cookies();
  const userCookie = cookies.find((c) => c.name === 'user_id');
  expect(userCookie, 'cookie user_id must be set for localhost').toBeDefined();
  expect(userCookie!.domain).toContain('localhost');

  const docs = await page.request.get('/api/documents/');
  expect(docs.status()).toBe(200);
});
