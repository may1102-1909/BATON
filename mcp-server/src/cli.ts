#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import { getCursor, pushCommit, pushFiles, pushMessages } from './api.js';
import { redactData, redactString } from './redact.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.baton', 'config.env') });

const SECRET_PATH = /(^|\/)(?:\.env(?:rc|\..*)?|\.npmrc|\.pypirc|\.netrc|secrets?(?:\.[^/]*)?|credentials?(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.[^/]*)?|[^/]*(?:secret|credential|token|private[-_]?key|service[-_]?account)[^/]*)(?:\/|$)/i;
const SENSITIVE_EXTENSION = /\.(?:env|pem|key|crt|cer|p12|pfx|keystore)$/i;
const BUILD_PATH = /(^|\/)(?:node_modules|dist|build|target|coverage|\.next|\.turbo|\.baton)(?:\/|$)/i;
const BINARY_PATH = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|wasm|exe|dll|so|dylib|class|jar|woff2?|ttf|otf|mp[34]|sqlite3?)$/i;

function safePath(relative: string): boolean {
  const normalized = relative.replaceAll('\\', '/');
  if (!normalized || normalized.length > 500 || normalized.startsWith('/') || normalized.split('/').some((part) => part === '..' || part === '.git')) return false;
  if (SECRET_PATH.test(normalized) || SENSITIVE_EXTENSION.test(normalized) || BUILD_PATH.test(normalized) || BINARY_PATH.test(normalized)) return false;
  return true;
}

async function getRepoRoot(): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel']);
  return stdout.trim();
}

// ----------------------------------------------------
// 1. Sync Commits & Changed Files
// ----------------------------------------------------
export async function syncCommit(ref = 'HEAD'): Promise<{ commitSha: string; filesSynced: number }> {
  const root = await getRepoRoot();
  const format = '%H%x1f%s%x1f%an%x1f%aI';
  const { stdout } = await execFileAsync('git', ['-C', root, 'show', '--name-only', `--format=${format}`, ref]);
  const parts = stdout.split('\n\n');
  const header = (parts[0] || '').trim();
  const fileLines = (parts[1] || '').trim().split('\n').map(l => l.trim()).filter(Boolean);

  const [sha, message, author, timestamp] = header.split('\x1f');
  if (!sha) throw new Error(`Could not resolve commit for ref ${ref}`);

  const safeFiles = fileLines.filter(safePath);

  // Get bounded diff summary
  let diffSummary = '';
  try {
    const { stdout: diffOut } = await execFileAsync('git', ['-C', root, 'diff', `${ref}~1..${ref}`, '--stat'], { timeout: 5000, maxBuffer: 128 * 1024 });
    diffSummary = diffOut.slice(0, 4000);
  } catch {
    // Initial commit or no parent
  }

  // Push commit record
  const commitRes = await pushCommit({
    sha,
    message: message || 'Commit',
    author: author || 'Engineer',
    files: safeFiles,
    diff_summary: diffSummary
  });
  if (!commitRes.success) {
    console.warn(`[Baton Sync] Warning: ${commitRes.message}`);
  }

  // Sync changed file summaries
  let filesSynced = 0;
  for (const relPath of safeFiles.slice(0, 20)) {
    try {
      const fullPath = path.join(root, relPath);
      const stat = await fs.lstat(fullPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) continue;
      const content = await fs.readFile(fullPath, 'utf8');
      const hash = createHash('sha256').update(content).digest('hex');

      await pushFiles({
        path: relPath,
        content_hash: hash,
        chunks: [content.slice(0, 10000)],
        commit_sha: sha
      });
      filesSynced++;
    } catch {
      // Ignored
    }
  }

  return { commitSha: sha, filesSynced };
}

// ----------------------------------------------------
// 2. Sync Agent Transcripts
// ----------------------------------------------------
export async function syncTranscripts(): Promise<{ messagesSynced: number }> {
  let messagesSynced = 0;
  const root = await getRepoRoot();

  // A. Check Claude Code logs under ~/.claude/projects/
  const home = os.homedir();
  const claudeProjectsDir = path.join(home, '.claude', 'projects');
  try {
    const entries = await fs.readdir(claudeProjectsDir).catch(() => []);
    for (const entry of entries) {
      const projDir = path.join(claudeProjectsDir, entry);
      const stat = await fs.stat(projDir).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;

      const files = await fs.readdir(projDir).catch(() => []);
      for (const file of files.filter(f => f.endsWith('.jsonl'))) {
        const fullPath = path.join(projDir, file);
        const sessionId = path.basename(file, '.jsonl');

        const cursorRes = await getCursor('claude-code', sessionId);
        const lastCursor = cursorRes.cursor;

        const raw = await fs.readFile(fullPath, 'utf8');
        const lines = raw.split('\n').filter(Boolean);
        const newTurns: Array<{ tool: string; sessionId: string; index: number; role: string; content: string; occurred_at?: string }> = [];

        let idx = 0;
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            idx++;
            if (idx <= lastCursor) continue;

            const role = parsed.role || parsed.type || 'user';
            const text = parsed.text || parsed.content || (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
            if (!text || text.length > 30000) continue;

            newTurns.push({
              tool: 'claude-code',
              sessionId,
              index: idx,
              role: String(role).slice(0, 20),
              content: String(text).slice(0, 25000),
              occurred_at: parsed.timestamp || new Date().toISOString()
            });
          } catch {}
        }

        if (newTurns.length > 0) {
          const res = await pushMessages(newTurns);
          if (res.success) messagesSynced += newTurns.length;
        }
      }
    }
  } catch {}

  // B. Check Antigravity transcripts if inside an Antigravity conversation
  try {
    const agyDir = path.resolve('.system_generated/logs');
    const transcriptPath = path.join(agyDir, 'transcript.jsonl');
    const stat = await fs.stat(transcriptPath).catch(() => null);
    if (stat && stat.isFile()) {
      const sessionId = path.basename(path.resolve('..'));
      const cursorRes = await getCursor('antigravity', sessionId);
      const lastCursor = cursorRes.cursor;

      const raw = await fs.readFile(transcriptPath, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      const newTurns: Array<{ tool: string; sessionId: string; index: number; role: string; content: string; occurred_at?: string }> = [];

      let idx = 0;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          idx++;
          if (idx <= lastCursor) continue;

          const role = parsed.source || parsed.type || 'assistant';
          const text = parsed.content || parsed.thinking || '';
          if (!text || text.length > 30000) continue;

          newTurns.push({
            tool: 'antigravity',
            sessionId,
            index: idx,
            role: String(role).slice(0, 20),
            content: String(text).slice(0, 25000),
            occurred_at: parsed.created_at || new Date().toISOString()
          });
        } catch {}
      }

      if (newTurns.length > 0) {
        const res = await pushMessages(newTurns);
        if (res.success) messagesSynced += newTurns.length;
      }
    }
  } catch {}

  return { messagesSynced };
}

const PACKAGE_SOURCE = 'github:may1102-1909/BATON';
const GENERATED_PATHS = ['.baton/', '.mcp.json', '.cursor/mcp.json', '.agents/mcp_config.json'];

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() : undefined;
}

async function readJson(file: string): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

/** Adds or replaces only the "baton" server so other MCP servers in the file survive. */
async function writeMcpConfig(file: string, server: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const config = await readJson(file);
  config.mcpServers = { ...(config.mcpServers ?? {}), baton: server };
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

// The generated files carry the API token, so they must never be committed.
async function ignoreGeneratedFiles(root: string): Promise<void> {
  const file = path.join(root, '.gitignore');
  const current = await fs.readFile(file, 'utf8').catch(() => '');
  const lines = new Set(current.split(/\r?\n/).map(line => line.trim()));
  const missing = GENERATED_PATHS.filter(entry => !lines.has(entry) && !lines.has(`/${entry}`));
  if (!missing.length) return;
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  await fs.writeFile(file, `${current}${prefix}\n# Baton MCP (contains API token)\n${missing.join('\n')}\n`);
}

// ----------------------------------------------------
// 3. Baton Init
// ----------------------------------------------------
export async function initProject(args: string[] = []): Promise<void> {
  const root = await getRepoRoot();
  console.log(`\n baton init: Initializing persistent repository memory for ${root}\n`);

  const apiUrl = flagValue(args, '--api-url') || process.env.BATON_API_URL?.trim() || 'https://baton-nu.vercel.app';
  const orgId = flagValue(args, '--org') || process.env.BATON_ORG_ID?.trim() || '';
  const repoId = flagValue(args, '--repo') || process.env.BATON_REPOSITORY_ID?.trim() || '';
  const apiKey = flagValue(args, '--key') || process.env.BATON_API_KEY?.trim() || '';
  const missing = [['--org / BATON_ORG_ID', orgId], ['--repo / BATON_REPOSITORY_ID', repoId], ['--key / BATON_API_KEY', apiKey]]
    .filter(([, value]) => !value).map(([name]) => name);

  const env = { BATON_API_URL: apiUrl, BATON_API_KEY: apiKey, BATON_ORG_ID: orgId, BATON_REPOSITORY_ID: repoId, BATON_REPO_PATH: root };
  Object.assign(process.env, env); // the backfill below reads its configuration from process.env
  await fs.mkdir(path.join(root, '.baton'), { recursive: true });
  const envPath = path.join(root, '.baton', 'config.env');
  await fs.writeFile(envPath, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
  await ignoreGeneratedFiles(root);
  console.log(` Saved configuration: ${envPath} (git-ignored)`);

  // A package run through npx lives in a disposable cache, so point clients at npx rather than that path.
  const fromNpxCache = __dirname.split(path.sep).includes('_npx');
  const server = fromNpxCache
    ? { command: 'npx', args: ['-y', PACKAGE_SOURCE, 'baton-mcp'], env }
    : { command: process.execPath, args: [path.join(__dirname, 'index.js')], env };
  const cliCommand = fromNpxCache ? `npx -y ${PACKAGE_SOURCE} baton` : `"${process.execPath}" "${path.join(__dirname, 'cli.js')}"`;

  // 1. Git post-commit hook (runs from the repository root, where .baton/config.env is loaded)
  const hooksDir = path.join(root, '.git', 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });
  const postCommitPath = path.join(hooksDir, 'post-commit');
  await fs.writeFile(postCommitPath, `#!/bin/sh\n# Baton background commit capture\n( ${cliCommand} sync --commit HEAD >/dev/null 2>&1 & )\n`, { mode: 0o755 });
  console.log(` Installed Git post-commit hook: ${postCommitPath}`);

  // 2. Project-scoped MCP client configs
  await writeMcpConfig(path.join(root, '.mcp.json'), server);
  await writeMcpConfig(path.join(root, '.cursor', 'mcp.json'), server);
  await writeMcpConfig(path.join(root, '.agents', 'mcp_config.json'), server);
  console.log(' Generated MCP client configs:');
  console.log('   Claude Code  -> .mcp.json');
  console.log('   Cursor       -> .cursor/mcp.json');
  console.log('   Antigravity  -> .agents/mcp_config.json');

  // 3. Claude Code Stop hook: sync transcript turns when a reply finishes
  const claudeSettingsPath = path.join(root, '.claude', 'settings.json');
  try {
    await fs.mkdir(path.dirname(claudeSettingsPath), { recursive: true });
    const settings = await readJson(claudeSettingsPath);
    const command = `${cliCommand} sync --transcripts`;
    const stop = (settings.hooks?.Stop ?? []).filter((entry: any) => !JSON.stringify(entry).includes('sync --transcripts'));
    settings.hooks = { ...(settings.hooks ?? {}), Stop: [...stop, { hooks: [{ type: 'command', command }] }] };
    await fs.writeFile(claudeSettingsPath, JSON.stringify(settings, null, 2) + '\n');
    console.log(` Configured Claude Code Stop hook: ${claudeSettingsPath}`);
  } catch {}

  if (missing.length) {
    console.log(`\n Missing ${missing.join(', ')}. Copy them from Baton → Settings → MCP and run baton init again; tools will fail until then.\n`);
    return;
  }

  // 4. Run first backfill
  console.log('\n Running initial baseline backfill (baton sync --all)...');
  const commitRes = await syncCommit('HEAD').catch(() => ({ commitSha: 'none', filesSynced: 0 }));
  const transRes = await syncTranscripts().catch(() => ({ messagesSynced: 0 }));
  console.log(` Backfill complete: Commit [${commitRes.commitSha.slice(0, 8)}] (${commitRes.filesSynced} files indexed), ${transRes.messagesSynced} transcript turns synced.`);
  console.log('\n Restart Claude Code / Antigravity / Cursor so they pick up the new MCP server.\n');
}

// ----------------------------------------------------
// CLI Dispatcher
// ----------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
Baton CLI: Continuous Repository Memory & Context Capture

Usage:
  baton mcp                   Start the Baton Model Context Protocol (MCP) server over stdio
  baton init [--api-url URL] [--org ID] [--repo ID] [--key TOKEN]
                              One-time setup: saves .baton/config.env, installs the git hook,
                              writes .mcp.json (Claude Code), .agents/mcp_config.json (Antigravity)
                              and .cursor/mcp.json
  baton sync --commit [ref]   Push commit metadata and changed-file summaries (default: HEAD)
  baton sync --transcripts    Extract and push new turns from local agent sessions (Claude Code, Antigravity)
  baton sync --all            Perform full synchronization of latest commit, files, and transcripts
  baton handover export [id] [--out path.md]
                              Save the approved handover packet as Markdown
                              (default: docs/handovers/handover-<id>.md, newest approved if no id)
`);
    return;
  }

  if (command === 'init') {
    await initProject(args.slice(1));
    return;
  }

  // `npx github:… baton-mcp` runs the package's default `baton` bin with "baton-mcp" as its argument.
  if (command === 'mcp' || command === 'serve' || command === 'start' || command === 'baton-mcp' || command === 'baton-mcp-server') {
    await import('./index.js');
    return;
  }

  if (command === 'handover' && args[1] === 'export') {
    const { exportHandoverFile } = await import('./handover.js');
    const id = args[2] && !args[2].startsWith('--') ? args[2] : undefined;
    const res = await exportHandoverFile(id, flagValue(args, '--out'));
    console.log(`[Baton] ${res.message}`);
    if (!res.success) process.exit(1);
    return;
  }

  if (command === 'sync') {
    const flag = args[1];
    if (flag === '--commit') {
      const ref = args[2] || 'HEAD';
      const res = await syncCommit(ref);
      console.log(`[Baton] Synced commit ${res.commitSha.slice(0, 8)} (${res.filesSynced} files)`);
      return;
    }
    if (flag === '--transcripts') {
      const res = await syncTranscripts();
      console.log(`[Baton] Synced ${res.messagesSynced} transcript turns`);
      return;
    }
    if (flag === '--all') {
      const cRes = await syncCommit('HEAD');
      const tRes = await syncTranscripts();
      console.log(`[Baton] Full sync: commit ${cRes.commitSha.slice(0, 8)} (${cRes.filesSynced} files), ${tRes.messagesSynced} turns`);
      return;
    }
  }

  console.error(`Unknown command: ${args.join(' ')}. Run 'baton --help' for usage.`);
  process.exit(1);
}

// Only dispatch when run as the CLI; the MCP server imports this module for sync_history and
// printing usage there would corrupt the stdio protocol stream.
const invokedPath = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[Baton CLI Error]', err?.message || err);
    process.exit(1);
  });
}
