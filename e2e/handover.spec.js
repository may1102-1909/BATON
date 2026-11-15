import { test, expect } from '@playwright/test';

// Whole demo handover flow: prepared handover, prefilled conflict, approval on resolve, Markdown and PDF export,
// then the incoming engineer acknowledges and asks a cited question.
test('admin resolves the prefilled conflict, exports Markdown and PDF; incoming engineer acknowledges and asks', async ({ page }) => {
  await page.goto('/demo-page');

  // Bus-factor alerts live under Handovers in the demo, not on the overview.
  await expect(page.getByRole('table')).toContainText('Bus factor');
  await expect(page.getByRole('region', { name: 'Bus factor alerts' })).toHaveCount(0);

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
  await conflicts.getByRole('button', { name: 'Resolve conflict' }).click();
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

  await page.getByRole('button', { name: /Incoming engineer/ }).click();
  await page.getByRole('tab', { name: /^Handovers/ }).click();
  await expect(page.getByText('Status: APPROVED')).toBeVisible();
  await page.getByRole('button', { name: 'Open packet' }).click();
  await expect(page.getByText(/items? hidden for your role/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Terraform');

  await page.getByRole('button', { name: 'Acknowledge handover' }).click();
  await expect(page.getByText(/acknowledged \d{4}-/i)).toBeVisible();

  await page.getByRole('textbox', { name: 'Your question' }).fill('What is the deadline for the walkthrough?');
  await page.getByRole('button', { name: 'Ask Baton' }).click();
  await expect(page.getByText('What is the deadline for the walkthrough?')).toBeVisible();
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
  await expect(page.getByText('Krishna Gupta').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('renoschubert');

  await page.getByRole('button', { name: '+ Invite member' }).click();
  await page.getByRole('button', { name: 'Generate invite' }).click();
  const link = await page.getByLabel('Invite link').inputValue();
  expect(link).toMatch(/\/demo-page\?join=/);
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();

  await page.getByRole('button', { name: '+ Generate MCP Token' }).first().click();
  await page.getByLabel(/Token name/).fill('claude code');
  await page.getByRole('button', { name: 'Create token' }).click();
  await expect(page.getByLabel('New token')).toHaveValue(/^baton_/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Run log_decision' }).click();
  await expect(page.getByText(/^Response 201/)).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: '/api/collector/push' })).toContainText('[REDACTED]');
  await expect(page.locator('pre').filter({ hasText: 'sk_live_SAMPLE' })).toHaveCount(0);

  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page.getByText(/Invite accepted: Invited teammate 1 joined the team/)).toBeVisible();
});
