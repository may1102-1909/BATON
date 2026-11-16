import { test, expect } from '@playwright/test';

// Whole demo handover flow: no handover until an MCP token exists, then the prepared handover, prefilled conflict,
// approval on resolve, and Markdown and PDF export.
test('the handover appears after an MCP token is created; resolving the conflict enables Markdown and PDF export', async ({ page }) => {
  await page.goto('/demo-page');

  // Bus-factor alerts live under Handovers in the demo, not on the overview.
  await expect(page.getByRole('table')).toContainText('Bus factor');
  await expect(page.getByRole('region', { name: 'Bus factor alerts' })).toHaveCount(0);

  // Only the admin is shown; there is no persona switcher.
  await expect(page.getByRole('button', { name: /Leaving engineer|Incoming engineer/ })).toHaveCount(0);

  await page.getByRole('tab', { name: /^Handovers/ }).click();
  await expect(page.getByText('Create an MCP token first')).toBeVisible();
  await expect(page.getByRole('button', { name: /Initiate Handover/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Start handover for/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to Team & Tokens' }).click();
  await page.getByRole('button', { name: '+ Generate MCP Token' }).first().click();
  await page.getByLabel(/Token name/).fill('claude code');
  await page.getByRole('button', { name: 'Create token' }).click();
  await expect(page.getByLabel('New token')).toHaveValue(/^baton_/);
  await page.keyboard.press('Escape');
  // The demo then explains the Antigravity connection; closing it scrolls to the Antigravity panel.
  await page.getByRole('dialog', { name: 'Antigravity is connected to Baton MCP' }).getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByTestId('antigravity-link')).toBeInViewport();
  await expect(page.getByText(/Baton has built the Krishna Gupta to Vikrant handover/)).toBeVisible();

  await page.getByRole('tab', { name: /^Handovers/ }).click();
  await expect(page.getByRole('button', { name: 'Handover Krishna Gupta → Vikrant (draft)' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bus factor alerts' }).getByRole('button', { name: /^Start handover for/ }).first()).toBeVisible();

  // Krishna's exit interview is already answered from the repository records.
  await expect(page.getByText(/RISK · SCORE \d+/i).first()).toBeVisible();
  await expect(page.getByText(/^Answer:/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Answer question:/ })).toHaveCount(0);

  const conflicts = page.getByRole('region', { name: 'Conflicts' });
  await expect(conflicts).toContainText('2026-11-10');
  await expect(conflicts).toContainText('2026-11-15');
  await expect(conflicts.getByRole('radio', { name: /Task comment/ })).toBeChecked();
  await expect(conflicts.getByRole('textbox', { name: 'Resolution explanation' })).toHaveValue(/^The task comment is correct/);
  await expect(page.getByRole('button', { name: /Export PDF/ })).toHaveCount(0);
  // Slow the demo engine so the loading state where the export buttons go is visible.
  await page.route('**/api/demo', async route => { const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 700)); await route.fulfill({ response }); });
  await conflicts.getByRole('button', { name: 'Resolve conflict' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preparing your export' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Preparing your export' })).toHaveCount(0, { timeout: 30_000 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await expect(conflicts).toContainText('All conflicts resolved');
  await expect(page.getByText('Status: APPROVED')).toBeVisible();

  const [markdown] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export Markdown/ }).click()]);
  expect(markdown.suggestedFilename()).toBe('handover-krishna-gupta-to-vikrant.md');
  const text = await (await markdown.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString('utf8'));
  expect(text).toMatch(/^# Engineering handover: Krishna Gupta to Vikrant/);
  expect(text).toContain('Exit interview with Krishna Gupta');
  expect(text).toMatch(/Resolved by May \(Admin\)/);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export PDF/ }).click()]);
  expect(pdf.suggestedFilename()).toBe('handover-krishna-gupta-to-vikrant.pdf');
  const bytes = await (await pdf.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString('latin1'));
  expect(bytes.startsWith('%PDF-1.4')).toBe(true);

  // Revoking the only token removes it and withdraws the handover until a new token is created.
  await page.getByRole('tab', { name: /^Team & Tokens/ }).click();
  await page.getByRole('button', { name: 'Revoke token claude code' }).click();
  await page.getByRole('dialog', { name: 'Revoke MCP token?' }).getByRole('button', { name: 'Revoke token' }).click();
  await expect(page.getByText(/the handover was withdrawn/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke token claude code' })).toHaveCount(0);
  await page.getByRole('tab', { name: /^Handovers/ }).click();
  await expect(page.getByText('Create an MCP token first')).toBeVisible();
  await expect(page.getByRole('button', { name: /Export PDF/ })).toHaveCount(0);

  await expect(page.locator('body')).not.toContainText(/undefined|\[object Object\]/);
});

test('demo GitHub, team invite and MCP tools work without signing in', async ({ page }) => {
  await page.goto('/demo-page');
  await expect(page.getByText('DEMO GUIDE')).toHaveCount(0);

  await page.getByRole('tab', { name: /^GitHub/ }).click();
  const connected = page.getByRole('dialog', { name: 'GitHub account connected' });
  await expect(connected).toContainText('@may1102-1909');
  await connected.getByRole('button', { name: 'Later' }).click();
  await expect(connected).toHaveCount(0);

  await page.getByRole('tab', { name: /^Team & Tokens/ }).click();
  await expect(page.getByText('Krishna Gupta', { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('renoschubert');

  await page.getByRole('button', { name: '+ Invite member' }).click();
  await expect(page.getByRole('note')).toContainText('can be opened by anyone');
  await page.getByRole('button', { name: 'Generate invite' }).click();
  const link = await page.getByLabel('Invite link').inputValue();
  expect(link).toMatch(/\/demo-page\?join=/);
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();

  await page.getByRole('button', { name: '+ Generate MCP Token' }).first().click();
  await page.getByLabel(/Token name/).fill('claude code');
  await page.getByRole('button', { name: 'Create token' }).click();
  await expect(page.getByLabel('New token')).toHaveValue(/^baton_/);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Antigravity is connected to Baton MCP' }).getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Run log_decision' }).click();
  await expect(page.getByText(/^Response 201/)).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: '/api/collector/push' })).toContainText('[REDACTED]');
  await expect(page.locator('pre').filter({ hasText: 'sk_live_SAMPLE' })).toHaveCount(0);

  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page.getByText(/Invite accepted: Invited teammate 1 joined the team/)).toBeVisible();
});
