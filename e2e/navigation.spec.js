import { test, expect } from '@playwright/test';

test('landing page links to the demo, which opens without signing in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /try the demo/i }).or(page.getByRole('button', { name: /try the demo/i })).first().click();
  await expect(page).toHaveURL(/\/demo-page/);
  await expect(page.getByText('BATON Team · DEMO').first()).toBeVisible();
});

test('dashboard without Supabase settings explains what is missing', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Baton is not configured' })).toBeVisible();
});

test('demo data never shows an email address', async ({ page }) => {
  await page.goto('/demo-page');
  await expect(page.getByRole('region', { name: 'Bus factor alerts' })).toBeVisible();
  for (const tab of ['Team & Tokens', 'Memory & Decisions']) {
    await page.getByRole('button', { name: new RegExp(`^${tab}`) }).click();
    expect(await page.locator('body').innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  }
});
