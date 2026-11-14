import { test, expect } from '@playwright/test';

// Renders the production Workspace against stubbed /api responses. A second Vite server is started with
// placeholder Supabase settings so the configuration gate passes; no real backend or credentials are used.
const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const SUPABASE_URL = 'http://127.0.0.1:54321';
const INVITE = 'i'.repeat(40);

const org = { id: 'org-1', name: 'Acme Platform', created_at: '2026-01-01T00:00:00Z' };
const repos = [
  { id: 'repo-1', org_id: 'org-1', full_name: 'acme/api', installation_id: 11, last_synced_at: '2026-02-01T10:00:00Z' },
  { id: 'repo-2', org_id: 'org-1', full_name: 'other-owner/web', installation_id: 22, last_synced_at: null },
];

let server;

test.beforeAll(async () => {
  process.env.VITE_SUPABASE_URL = SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
  const { createServer } = await import('vite');
  server = await createServer({ logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1', hmr: false } });
  await server.listen();
});

test.afterAll(async () => {
  await server?.close();
});

async function stubApi(page, { calls, repositories = repos } = {}) {
  const log = calls || [];
  await page.route(`${SUPABASE_URL}/**`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    log.push({ key, body: request.postData() ? JSON.parse(request.postData()) : null });
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (key === 'GET /api/health') return json({ ok: true, configured: { supabase: true, github: true }, githubInstallUrl: 'https://github.com/apps/baton-test/installations/new' });
    if (key === 'GET /api/me') return json({ user: { id: 'user-1', email: 'owner@example.test' }, organizations: [{ id: 'org-1', name: org.name, role: 'admin' }] });
    if (key === 'GET /api/orgs/org-1/state') {
      return json({
        organization: org,
        members: [{ id: 'm1', org_id: 'org-1', user_id: 'user-1', role: 'admin', name: 'Owner', email: 'owner@example.test' }],
        repositories,
        sources: [],
        tasks: [],
        handovers: [],
        tokens: [],
      });
    }
    if (key === 'GET /api/orgs/org-1/risks') return json({ alerts: [], risks: [], counts: {}, bus_factor: [], matrix: { modules: [] }, modules: [] });
    if (key === 'GET /api/orgs/org-1/github/installations') return json([{ id: 5, account: { login: 'octo' } }]);
    if (key === 'GET /api/orgs/org-1/github/installations/5/repositories') return json([{ full_name: 'octo/hello' }, { full_name: 'acme/api' }]);
    if (key === 'POST /api/orgs/org-1/repositories') {
      const name = JSON.parse(request.postData()).fullName;
      if (name === 'octo/private') return json({ error: 'The Baton GitHub App is not installed on octo/private. Install it, then try again.', install_url: 'https://github.com/apps/baton-test/installations/new?target=octo' }, 400);
      return json({ id: 'repo-3', full_name: name }, 201);
    }
    if (key === 'DELETE /api/orgs/org-1/repositories/repo-2') return json({ deleted: true, removed_sources: 3 });
    if (key === 'PATCH /api/orgs/org-1') return json({ organization: { ...org, name: JSON.parse(request.postData()).name } });
    if (key === 'POST /api/orgs/org-1/reset') return json({ removed: { sources: 2, tasks: 0, handovers: 0 } });
    if (key === 'POST /api/orgs/org-1/invites') return json({ token: INVITE, role: 'member' }, 201);
    if (key === 'POST /api/invites/accept') return json({ organization_id: 'org-1' });
    return json({ error: `Unstubbed ${key}` }, 404);
  });
  return log;
}

async function signIn(page) {
  // Placeholder session in the shape supabase-js stores, valid far into the future.
  await page.addInitScript(() => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 4102444800,
      user: { id: 'user-1', email: 'owner@example.test', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }));
  });
}

test('production overview has a checklist and real system status, no demo content', async ({ page }) => {
  await stubApi(page);
  await signIn(page);
  await page.goto(`${BASE}/dashboard`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('tab', { name: /^Overview/ })).toHaveAttribute('aria-selected', 'true');
  const checklist = page.getByRole('region', { name: /Get started/ });
  await expect(checklist).toContainText('Connect a GitHub repository');
  await expect(checklist.getByRole('listitem').filter({ hasText: 'Connect a GitHub repository' })).toContainText('Done');
  await expect(checklist.getByRole('listitem').filter({ hasText: 'Create an MCP token' })).toContainText('To do');

  const status = page.getByRole('region', { name: 'System status' });
  await expect(status).toContainText('Online');
  await expect(status).toContainText('Supabase configured');
  await expect(status).toContainText('2 repositories connected');
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/RLS enabled|StdioServerTransport|Configured & Active|Open the demo|synthetic\/baton-demo|Demo Mode/i);

  await checklist.getByRole('button', { name: 'Dismiss' }).click();
  await expect(checklist).toHaveCount(0);
});

test('GitHub tab lists every repository, connects another and disconnects one', async ({ page }) => {
  const calls = await stubApi(page);
  await signIn(page);
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('tab', { name: /^GitHub/ }).click();

  await expect(page.getByText('acme/api', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('other-owner/web', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Connect another repository')).toBeVisible();

  // The repository the server cannot reach shows its message plus an install link.
  await page.getByRole('textbox', { name: /Or enter owner\/repo/ }).fill('octo/private');
  await page.getByRole('button', { name: 'Connect by name' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'not installed on octo/private' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Install the GitHub App' }).first()).toHaveAttribute('href', /target=octo/);

  await page.getByRole('textbox', { name: /Or enter owner\/repo/ }).fill('octo/other');
  await page.getByRole('button', { name: 'Connect by name' }).click();
  await expect(page.getByText(/octo\/other connected/)).toBeVisible();
  expect(calls.find(call => call.key === 'POST /api/orgs/org-1/repositories' && call.body.fullName === 'octo/other')).toBeTruthy();

  await page.getByRole('button', { name: 'Disconnect other-owner/web' }).click();
  const dialog = page.getByRole('dialog', { name: /Disconnect other-owner\/web/ });
  await expect(dialog).toContainText('removes the commits, pull requests and branches');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Disconnect other-owner/web' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect repository' }).click();
  await expect(page.getByText(/other-owner\/web disconnected\. 3 synced records removed/)).toBeVisible();
  expect(calls.some(call => call.key === 'DELETE /api/orgs/org-1/repositories/repo-2')).toBe(true);
});

test('team tab: workspace settings, typed confirmations, invite link and repository picker', async ({ page }) => {
  const calls = await stubApi(page);
  await signIn(page);
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('tab', { name: /^Team & Tokens/ }).click();

  await expect(page.getByRole('combobox', { name: /Repository this configuration captures into/ })).toBeVisible();

  const settings = page.getByRole('region', { name: 'Workspace settings' });
  await settings.getByRole('textbox', { name: 'Workspace name', exact: true }).fill('Acme Renamed');
  await settings.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByText('Workspace renamed.')).toBeVisible();
  expect(calls.find(call => call.key === 'PATCH /api/orgs/org-1').body).toEqual({ name: 'Acme Renamed' });

  const clear = settings.getByRole('button', { name: 'Clear data' });
  await expect(clear).toBeDisabled();
  await settings.getByRole('textbox', { name: /Type the workspace name .* to confirm/ }).first().fill('Acme Renamed');
  await expect(clear).toBeEnabled();
  await settings.getByRole('radio', { name: /Everything/ }).check();
  await clear.click();
  await expect(page.getByText(/Workspace data cleared: 2 records/)).toBeVisible();
  expect(calls.find(call => call.key === 'POST /api/orgs/org-1/reset').body).toEqual({ confirm: 'Acme Renamed', scope: 'all' });

  await expect(settings.getByRole('button', { name: 'Delete workspace' })).toBeDisabled();

  await page.getByRole('button', { name: '+ Invite member' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite team member' });
  await dialog.getByRole('button', { name: 'Generate invite' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Invite link' })).toHaveValue(`${BASE}/auth?invite=${INVITE}`);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('a stored invite is accepted before the account data loads, then the dashboard opens', async ({ page }) => {
  const calls = await stubApi(page);
  await signIn(page);
  await page.addInitScript(token => sessionStorage.setItem('baton_invite', token), INVITE);
  await page.goto(`${BASE}/dashboard`);

  await expect(page.getByText('Invite accepted. You joined the team.')).toBeVisible();
  const keys = calls.map(call => call.key);
  expect(keys.indexOf('POST /api/invites/accept')).toBeGreaterThanOrEqual(0);
  expect(keys.indexOf('POST /api/invites/accept')).toBeLessThan(keys.indexOf('GET /api/me'));
  expect(calls.find(call => call.key === 'POST /api/invites/accept').body).toEqual({ token: INVITE });
  expect(await page.evaluate(() => sessionStorage.getItem('baton_invite'))).toBeNull();
  await expect(page).toHaveURL(/\/dashboard$/);
});
