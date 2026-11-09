import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { answerExitQuestion, getExitInterviews, getGithubActivity, pushMemory, queryContext } from '../dist/api.js';
import { redactData, redactString } from '../dist/redact.js';
import { bootstrapProject } from '../dist/snapshot.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.resolve(here, '../.baton');
const environment = ['BATON_API_URL', 'BATON_API_KEY', 'BATON_ORG_ID', 'BATON_REPOSITORY_ID', 'BATON_REPO_PATH', 'BATON_SESSION_ID'];
const originalEnvironment = Object.fromEntries(environment.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function configure(extra = {}) {
  Object.assign(process.env, {
    BATON_API_URL: 'https://baton.example.test',
    BATON_API_KEY: 'local-test-key-not-a-real-credential',
    BATON_ORG_ID: 'org-test-1',
    BATON_REPOSITORY_ID: 'repo-test-1',
    BATON_SESSION_ID: 'session-test-1',
    ...extra
  });
}

after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of environment) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
  await rm(cachePath, { recursive: true, force: true });
});

test('redaction removes secret assignments and sensitive response fields', () => {
  const secret = 'super-secret-value-that-should-not-escape';
  assert.equal(redactString(`API_KEY=${secret}`).includes(secret), false);
  assert.equal(redactData({ author: 'A normal author', access_token: secret }).author, 'A normal author');
  assert.equal(JSON.stringify(redactData({ access_token: secret })).includes(secret), false);
});

test('API requests require credentials, apply repository scope, and redact backend responses', async () => {
  configure();
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: new URL(url), init };
    return new Response(JSON.stringify({ access_token: 'remote-secret-value-123456789' }), { status: 200 });
  };
  const search = await queryContext('decision');
  assert.equal(search.success, true);
  assert.equal(captured.url.searchParams.get('org_id'), 'org-test-1');
  assert.equal(captured.url.searchParams.get('repository_id'), 'repo-test-1');
  assert.equal(captured.init.headers.Authorization, `Bearer ${process.env.BATON_API_KEY}`);
  assert.equal(JSON.stringify(search).includes('remote-secret-value-123456789'), false);

  await getExitInterviews();
  assert.equal(captured.url.pathname, '/api/mcp/interviews');
  assert.equal(captured.url.searchParams.get('org_id'), 'org-test-1');
  assert.equal(captured.url.searchParams.get('repository_id'), 'repo-test-1');

  delete process.env.BATON_API_KEY;
  let requestCount = 0;
  globalThis.fetch = async () => { requestCount++; return new Response('{}'); };
  const missingKey = await pushMemory('change', { content: 'new change' });
  assert.equal(missingKey.success, false);
  assert.match(missingKey.message, /BATON_API_KEY/);
  assert.equal(requestCount, 0);

  configure();
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Bearer remote-secret-token-value' }), { status: 401 });
  const rejected = await answerExitQuestion('interview-1', 'question-1', 'safe answer');
  assert.equal(rejected.success, false);
  assert.equal(JSON.stringify(rejected).includes('remote-secret-token-value'), false);
});

test('github activity includes only sources explicitly scoped to the configured repository', async () => {
  configure();
  let requested;
  globalThis.fetch = async (url) => {
    requested = new URL(url);
    return new Response(JSON.stringify({
      repositories: [{ id: 'repo-test-1', name: 'current' }, { id: 'repo-other', name: 'other' }],
      sources: [{ repository_id: 'repo-test-1', content: 'current source' }, { repository_id: 'repo-other', content: 'other source' }]
    }));
  };
  const result = await getGithubActivity();
  assert.equal(result.success, true);
  assert.equal(requested.pathname, '/api/orgs/org-test-1/state');
  assert.equal(requested.searchParams.get('repository_id'), 'repo-test-1');
  assert.deepEqual(result.data.activity.map((source) => source.content), ['current source']);
});

test('bootstrap sends bounded tracked-file metadata, skips secrets, and saves only successful baselines', async () => {
  configure();
  await rm(cachePath, { recursive: true, force: true });
  const root = await mkdtemp(path.join(os.tmpdir(), 'baton-mcp-'));
  process.env.BATON_REPO_PATH = root;
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'README.md'), '# Safe heading\nAPI_KEY=not-a-real-secret-but-never-send\nPrivate prose');
  await writeFile(path.join(root, 'src', 'example.ts'), 'export const first = true;\n');
  await writeFile(path.join(root, '.env'), 'BATON_API_KEY=should-not-be-read');
  await writeFile(path.join(root, 'secrets.txt'), 'private values');
  if (process.platform !== 'win32') {
    await writeFile(path.join(root, 'src', 'untracked-target.ts'), 'untracked symlink target');
    await symlink('untracked-target.ts', path.join(root, 'src', 'linked.ts'));
  }
  const git = (...args) => new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: root, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git exited ${code}`)));
  });
  await git('init', '-q');
  await git('add', '.');

  let count = 0;
  const events = [];
  globalThis.fetch = async (_url, init) => {
    count++;
    const event = JSON.parse(init.body);
    events.push(event);
    if (count === 1) return new Response(JSON.stringify({ error: 'not authorized yet' }), { status: 401 });
    return new Response(JSON.stringify({ success: true }));
  };
  const rejected = await bootstrapProject();
  assert.equal(rejected.success, false);
  assert.equal(count, 1);

  globalThis.fetch = async (_url, init) => {
    count++;
    events.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }));
  };
  const initial = await bootstrapProject();
  assert.equal(initial.success, true);
  assert.equal(initial.data.initial_snapshot, true);
  assert.equal(events[1].type, 'bootstrap');
  assert.ok(events[1].session_id);
  const serialized = JSON.stringify(events[1]);
  assert.equal(serialized.includes('should-not-be-read'), false);
  assert.equal(serialized.includes('private values'), false);
  assert.equal(serialized.includes('Private prose'), false);
  assert.equal(serialized.includes('README.md'), true);
  assert.equal(serialized.includes('src/example.ts'), true);
  if (process.platform !== 'win32') {
    assert.equal(events[1].data.changed_files.some((file) => file.path === 'src/linked.ts'), false);
  }

  await writeFile(path.join(root, 'src', 'untracked.ts'), 'not included');
  const unchanged = await bootstrapProject();
  assert.equal(unchanged.success, true);
  assert.equal(unchanged.data.unchanged, true);
  assert.equal(count, 2);

  await writeFile(path.join(root, 'src', 'example.ts'), 'export const changed = true;\n');
  const incremental = await bootstrapProject();
  assert.equal(incremental.success, true);
  assert.equal(incremental.data.initial_snapshot, false);
  assert.deepEqual(events[2].data.changed_files.map((file) => file.path), ['src/example.ts']);
  assert.equal(JSON.stringify(events[2]).includes('export const changed'), false);

  await rm(root, { recursive: true, force: true });
});

test('MCP stdio publishes tools and bootstrap prompt', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(here, '../dist/index.js')],
    env: { ...process.env }
  });
  const client = new Client({ name: 'baton-mcp-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'answer_exit_question', 'bootstrap_project', 'get_context', 'get_exit_interview',
      'github_activity', 'log_blocker', 'log_decision', 'save_memory'
    ]);
    const prompts = await client.listPrompts();
    assert.ok(prompts.prompts.some((prompt) => prompt.name === 'baton_bootstrap'));
  } finally {
    await client.close();
  }
});
