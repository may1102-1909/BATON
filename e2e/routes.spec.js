import { test, expect } from '@playwright/test';

for (const legacy of ['/review', '/inspect', '/tasks', '/claims', '/classic']) {
  test(`retired route ${legacy} redirects to the dashboard`, async ({ page }) => {
    await page.goto(legacy);
    await expect(page).toHaveURL(/\/(dashboard|auth)$/);
    await expect(page.locator('body')).not.toContainText(/Mock|sample data|Lorem/i);
  });
}

test('an invite link keeps its token for after sign-in', async ({ page }) => {
  await page.goto('/auth?invite=abc123-invite-token');
  await expect(page.getByText('You have been invited to a team')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('baton_invite'))).toBe('abc123-invite-token');
  await expect(page).not.toHaveURL(/invite=/);

  // The token survives switching between sign-in and sign-up.
  await page.getByRole('tab', { name: 'Create Account' }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('baton_invite'))).toBe('abc123-invite-token');
});

test('the landing page offers a sign-in path without waiting for the animation', async ({ page }) => {
  await page.goto('/');
  const signIn = page.getByRole('link', { name: 'Sign in' });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('the demo workspace never offers workspace management or the first-run checklist', async ({ page }) => {
  await page.goto('/demo-page');
  await expect(page.getByRole('region', { name: 'Bus factor alerts' })).toBeVisible();
  await expect(page.getByText('Get started')).toHaveCount(0);
  await page.getByRole('tab', { name: /^Team & Tokens/ }).click();
  await expect(page.getByRole('heading', { name: 'Organization members' })).toBeVisible();
  await expect(page.getByText('Workspace settings')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Delete workspace/ })).toHaveCount(0);
  await page.getByRole('tab', { name: /^GitHub/ }).click();
  await expect(page.getByRole('button', { name: /^Disconnect/ })).toHaveCount(0);
});

test('the usage guide shows no fabricated product data', async ({ page }) => {
  await page.goto('/usage');
  await expect(page.getByRole('heading', { level: 1, name: 'Getting started with Baton' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open dashboard|Try the sample/ }).or(page.getByRole('button', { name: /Open dashboard/ })).first()).toBeVisible();
});
