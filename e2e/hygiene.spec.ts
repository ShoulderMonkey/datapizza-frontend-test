import { test, expect, type Page } from '@playwright/test';

// P2-11: icon served + clean console, no backend Location leak on collection routes, no duplicate first-page fetches.

const USER = 'hygiene-t041';
// Dev (React StrictMode) double-invokes effects: 2 first-page requests are expected. Production must do 1.
const IS_PROD = !!process.env.PLAYWRIGHT_BASE_URL;
const MAX_FIRST_PAGE = IS_PROD ? 1 : 2;

async function login(page: Page) {
  await page.goto('/');
  await page.locator('#user_id').fill(USER);
  await page.getByRole('button', { name: /accedi all/i }).click();
  await expect(page.getByRole('textbox', { name: 'Domanda sui documenti' })).toBeVisible();
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  // No 4xx/5xx is expected on the first load (no allow-list needed).
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return problems;
}

async function expectIcon(page: Page) {
  const href = await page.locator('link[rel~="icon"]').first().getAttribute('href');
  expect(href, 'link[rel=icon] missing').toBeTruthy();
  const res = await page.request.get(new URL(href!, page.url()).toString());
  expect(res.status()).toBe(200);
}

test.describe('hygiene', () => {
  test('login page: icon served and console clean', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/');
    await expect(page.locator('#user_id')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectIcon(page);
    expect(problems).toEqual([]);
  });

  test('home after login: icon served and console clean', async ({ page }) => {
    await login(page);
    const problems = watch(page);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Domanda sui documenti' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectIcon(page);
    expect(problems).toEqual([]);
  });

  for (const withSession of [false, true]) {
    test(`collection routes without slash never redirect to the backend (${withSession ? 'with' : 'no'} session)`, async ({
      page,
      context,
    }) => {
      if (withSession) await login(page);
      const req = withSession ? page.request : (await context.request);
      const check = async (method: 'GET' | 'POST', path: string) => {
        const res =
          method === 'GET'
            ? await req.get(path, { maxRedirects: 0 })
            : await req.post(path, { maxRedirects: 0, data: { message: 'x' } });
        const loc = res.headers()['location'];
        if (res.status() >= 300 && res.status() < 400) {
          expect(loc, `${method} ${path} redirected`).toBeTruthy();
          expect(new URL(loc!, 'http://same.origin').host, `${method} ${path} Location`).toBe('same.origin');
        }
        if (loc) expect(loc).not.toMatch(/:8000|backend/);
      };
      await check('GET', '/api/documents');
      await check('GET', '/api/chat');
      await check('POST', '/api/chat');
    });
  }

  test(`first page of history and documents is requested at most ${MAX_FIRST_PAGE}x on reload`, async ({ page }) => {
    // Dev threshold is 2 because StrictMode runs effects twice; set PLAYWRIGHT_BASE_URL to a production build for 1.
    await login(page);
    const seen: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET') return;
      const u = new URL(r.url());
      if (/^\/api\/(chat|documents)\/$/.test(u.pathname) && (u.searchParams.get('offset') ?? '0') === '0') {
        seen.push(u.pathname);
      }
    });
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Domanda sui documenti' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const count = (p: string) => seen.filter((s) => s === p).length;
    expect(count('/api/chat/'), `history requests: ${seen}`).toBeGreaterThanOrEqual(1);
    expect(count('/api/chat/')).toBeLessThanOrEqual(MAX_FIRST_PAGE);
    expect(count('/api/documents/')).toBeGreaterThanOrEqual(1);
    expect(count('/api/documents/')).toBeLessThanOrEqual(MAX_FIRST_PAGE);
  });
});
