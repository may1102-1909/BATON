import { test, expect } from '@playwright/test';

// Whole handover flow in the demo sandbox: alert, scored questions, conflict, approval, acknowledgement, cited Q&A.
test('admin resolves the conflict and approves; incoming engineer acknowledges and asks', async ({ page }) => {
  await page.goto('/demo-page');

  const alerts = page.getByRole('region', { name: 'Bus factor alerts' });
  await expect(alerts.getByRole('button', { name: /^Start handover for/ }).first()).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Bus factor');

  await page.getByRole('button', { name: /^Handovers/ }).click();
  await page.getByRole('button', { name: /^Handover .*\(draft\)/ }).click();

  // The top question is the single-contributor module, with its score and reason.
  await expect(page.getByText(/RISK · SCORE \d+/i).first()).toBeVisible();
  await expect(page.getByText(/^Bus factor 1: only/).first()).toBeVisible();

  const conflicts = page.getByRole('region', { name: 'Conflicts' });
  await expect(conflicts).toContainText('Baton does not pick a winner');
  await expect(conflicts).toContainText('2026-11-10');
  await expect(conflicts).toContainText('2026-11-15');
  await expect(page.getByRole('button', { name: /Approve Handover/ })).toBeDisabled();
  await conflicts.getByRole('radio', { name: /Task comment/ }).check();
  await conflicts.getByRole('textbox', { name: 'Resolution explanation' }).fill('Review slipped; 15 Nov confirmed.');
  await conflicts.getByRole('button', { name: 'Resolve conflict' }).click();
  await expect(conflicts).toContainText('All conflicts resolved');

  const approve = page.getByRole('button', { name: /^Approve claim:/, pressed: false });
  await expect(approve.first()).toBeVisible();
  for (let remaining = await approve.count(); remaining > 0; remaining = await approve.count()) {
    await approve.first().click();
    await expect(approve).toHaveCount(remaining - 1);
  }
  await page.getByRole('button', { name: /Approve Handover/ }).click();
  await expect(page.getByText('Status: APPROVED')).toBeVisible();

  await page.getByRole('button', { name: /Incoming engineer/ }).click();
  await page.getByRole('button', { name: /^Handovers/ }).click();
  await page.getByRole('button', { name: /^Handover .*\(approved\)/ }).click();
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
