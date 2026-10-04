import { test, expect } from '@playwright/test';

// Minimal PDF with a name the backend does not know: POST /api/documents/ answers 400 and stores nothing.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

test('upload of a non-admitted PDF shows a friendly message and leaves the document list unchanged', async ({ page }) => {
  await page.goto('/');
  await page.locator('#user_id').fill('test_user');
  await page.getByRole('button', { name: /accedi all/i }).click();
  await expect(page.getByRole('textbox').last()).toBeVisible();

  await page.getByRole('button', { name: /libreria pdf/i }).click();
  const dialogTitle = page.getByRole('heading', { name: 'Libreria Documenti PDF' });
  await expect(dialogTitle).toBeVisible();
  const countText = page.getByText(/\d+ file disponibili sul backend/);
  // Loaded list only: spinner gone and a non-zero count consistent with the rendered rows.
  await expect(page.getByText('Recupero documenti dal server...')).toHaveCount(0, { timeout: 15_000 });
  await expect(countText).toHaveText(/^[1-9]\d* file disponibili sul backend$/, { timeout: 15_000 });
  const rows = page.getByRole('button', { name: /visualizza pdf/i });
  const before = (await countText.textContent())!;
  const beforeItems = Number(/^(\d+)/.exec(before)![1]);
  await expect(rows).toHaveCount(beforeItems);

  await page.getByRole('button', { name: /carica nuovi pdf/i }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'non-ammesso.pdf',
    mimeType: 'application/pdf',
    buffer: MINIMAL_PDF,
  });
  await page.getByRole('button', { name: /carica 1 file/i }).click();

  await expect(page.getByText(/«non-ammesso\.pdf»/)).toBeVisible({ timeout: 15_000 });
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/is not recognized|Please upload one of/i);

  await page.getByRole('button', { name: /^documenti \(\d+\)$/i }).click();
  await expect(page.getByText('Recupero documenti dal server...')).toHaveCount(0);
  await expect(countText).toHaveText(before);
  await page.getByRole('button', { name: 'Aggiorna', exact: true }).click();
  await expect(page.getByText('Recupero documenti dal server...')).toHaveCount(0);
  await expect(countText).toHaveText(before);
  await expect(rows).toHaveCount(beforeItems);
});
