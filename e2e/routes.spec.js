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

test('the landing page offers Launch App (no separate Sign in) without waiting for the animation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
  const signIn = page.getByRole('link', { name: 'Launch App' });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('the demo workspace never offers workspace management or the first-run checklist', async ({ page }) => {
  await page.goto('/demo-page');
  await expect(page.getByRole('table')).toContainText('Bus factor');
  await expect(page.getByText('Get started')).toHaveCount(0);
  await page.getByRole('tab', { name: /^Team & Tokens/ }).click();
  await expect(page.getByRole('heading', { name: 'Organization members' })).toBeVisible();
  await expect(page.getByText('Workspace settings')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Delete workspace/ })).toHaveCount(0);
  await page.getByRole('tab', { name: /^GitHub/ }).click();
  await page.getByRole('dialog', { name: 'GitHub account connected' }).getByRole('button', { name: 'Later' }).click();
  await expect(page.getByRole('button', { name: /^Disconnect/ })).toHaveCount(0);
});

test('the usage page shows the overview, developer notes and features, and both experiences', async ({ page }) => {
  await page.goto('/usage');
  await expect(page.getByRole('heading', { level: 1, name: /Pass the knowledge/ })).toBeVisible();
  await expect(page.getByText('Behind the code.')).toBeAttached();
  await expect(page.getByText('A handover. Not a guessing game.')).toBeAttached();
  await page.getByRole('button', { name: 'Demo Mode' }).click();
  await expect(page).toHaveURL(/\/demo-page/);
});
