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
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const SECRET_PATH = /(^|\/)(?:\.env(?:rc|\..*)?|\.npmrc|\.pypirc|\.netrc|secrets?(?:\.[^/]*)?|credentials?(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.[^/]*)?|[^/]*(?:secret|credential|token|private[-_]?key|service[-_]?account)[^/]*)(?:\/|$)/i;
const SENSITIVE_EXTENSION = /\.(?:env|pem|key|crt|cer|p12|pfx|keystore)$/i;
const BUILD_PATH = /(^|\/)(?:node_modules|dist|build|target|coverage|\.next|\.turbo|\.baton)(?:\/|$)/i;
const BINARY_PATH = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|wasm|exe|dll|so|dylib|class|jar|woff2?|ttf|otf|mp[34]|sqlite3?)$/i;
function safePath(relative) {
    const normalized = relative.replaceAll('\\', '/');
    if (!normalized || normalized.length > 500 || normalized.startsWith('/') || normalized.split('/').some((part) => part === '..' || part === '.git'))
        return false;
    if (SECRET_PATH.test(normalized) || SENSITIVE_EXTENSION.test(normalized) || BUILD_PATH.test(normalized) || BINARY_PATH.test(normalized))
        return false;
    return true;
}
async function getRepoRoot() {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel']);
    return stdout.trim();
}
// ----------------------------------------------------
// 1. Sync Commits & Changed Files
// ----------------------------------------------------
export async function syncCommit(ref = 'HEAD') {
    const root = await getRepoRoot();
    const format = '%H%x1f%s%x1f%an%x1f%aI';
    const { stdout } = await execFileAsync('git', ['-C', root, 'show', '--name-only', `--format=${format}`, ref]);
    const parts = stdout.split('\n\n');
    const header = (parts[0] || '').trim();
    const fileLines = (parts[1] || '').trim().split('\n').map(l => l.trim()).filter(Boolean);
    const [sha, message, author, timestamp] = header.split('\x1f');
    if (!sha)
        throw new Error(`Could not resolve commit for ref ${ref}`);
    const safeFiles = fileLines.filter(safePath);
    // Get bounded diff summary
    let diffSummary = '';
    try {
        const { stdout: diffOut } = await execFileAsync('git', ['-C', root, 'diff', `${ref}~1..${ref}`, '--stat'], { timeout: 5000, maxBuffer: 128 * 1024 });
        diffSummary = diffOut.slice(0, 4000);
    }
    catch {
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
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024)
                continue;
            const content = await fs.readFile(fullPath, 'utf8');
            const hash = createHash('sha256').update(content).digest('hex');
            await pushFiles({
                path: relPath,
                content_hash: hash,
                chunks: [content.slice(0, 10000)],
                commit_sha: sha
            });
            filesSynced++;
        }
        catch {
            // Ignored
        }
    }
    return { commitSha: sha, filesSynced };
}
// ----------------------------------------------------
// 2. Sync Agent Transcripts
// ----------------------------------------------------
export async function syncTranscripts() {
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
            if (!stat || !stat.isDirectory())
                continue;
            const files = await fs.readdir(projDir).catch(() => []);
            for (const file of files.filter(f => f.endsWith('.jsonl'))) {
                const fullPath = path.join(projDir, file);
                const sessionId = path.basename(file, '.jsonl');
                const cursorRes = await getCursor('claude-code', sessionId);
                const lastCursor = cursorRes.cursor;
                const raw = await fs.readFile(fullPath, 'utf8');
                const lines = raw.split('\n').filter(Boolean);
                const newTurns = [];
                let idx = 0;
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        idx++;
                        if (idx <= lastCursor)
                            continue;
                        const role = parsed.role || parsed.type || 'user';
                        const text = parsed.text || parsed.content || (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
                        if (!text || text.length > 30000)
                            continue;
                        newTurns.push({
                            tool: 'claude-code',
                            sessionId,
                            index: idx,
                            role: String(role).slice(0, 20),
                            content: String(text).slice(0, 25000),
                            occurred_at: parsed.timestamp || new Date().toISOString()
                        });
                    }
                    catch { }
                }
                if (newTurns.length > 0) {
                    const res = await pushMessages(newTurns);
                    if (res.success)
                        messagesSynced += newTurns.length;
                }
            }
        }
    }
    catch { }
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
            const newTurns = [];
            let idx = 0;
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    idx++;
                    if (idx <= lastCursor)
                        continue;
                    const role = parsed.source || parsed.type || 'assistant';
                    const text = parsed.content || parsed.thinking || '';
                    if (!text || text.length > 30000)
                        continue;
                    newTurns.push({
                        tool: 'antigravity',
                        sessionId,
                        index: idx,
                        role: String(role).slice(0, 20),
                        content: String(text).slice(0, 25000),
                        occurred_at: parsed.created_at || new Date().toISOString()
                    });
                }
                catch { }
            }
            if (newTurns.length > 0) {
                const res = await pushMessages(newTurns);
                if (res.success)
                    messagesSynced += newTurns.length;
            }
        }
    }
    catch { }
    return { messagesSynced };
}
// ----------------------------------------------------
// 3. Baton Init
// ----------------------------------------------------
export async function initProject() {
    const root = await getRepoRoot();
    console.log(`\n baton init: Initializing persistent repository memory for ${root}\n`);
    const apiUrl = process.env.BATON_API_URL?.trim() || 'https://baton-nu.vercel.app';
    const orgId = process.env.BATON_ORG_ID?.trim() || '';
    const repoId = process.env.BATON_REPOSITORY_ID?.trim() || '';
    const apiKey = process.env.BATON_API_KEY?.trim() || '';
    // Write .env in mcp-server with mode 0600
    const envContent = [
        `BATON_API_URL=${apiUrl}`,
        `BATON_ORG_ID=${orgId}`,
        `BATON_REPOSITORY_ID=${repoId}`,
        `BATON_API_KEY=${apiKey}`,
        `BATON_REPO_PATH=${root}`
    ].join('\n') + '\n';
    const mcpEnvPath = path.join(root, 'mcp-server', '.env');
    await fs.writeFile(mcpEnvPath, envContent, { mode: 0o600 });
    console.log(` Created secure configuration: ${mcpEnvPath}`);
    // 1. Install git post-commit hook
    const hooksDir = path.join(root, '.git', 'hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    const postCommitPath = path.join(hooksDir, 'post-commit');
    const postCommitScript = `#!/bin/sh\n# Baton background commit capture\n( node "${path.join(root, 'mcp-server/dist/cli.js')}" sync --commit HEAD >/dev/null 2>&1 & )\n`;
    await fs.writeFile(postCommitPath, postCommitScript, { mode: 0o755 });
    console.log(` Installed Git post-commit hook: ${postCommitPath}`);
    // 2. Client MCP Configs
    const nodeBin = process.execPath;
    const serverScript = path.join(root, 'mcp-server/dist/index.js');
    const mcpConfig = {
        mcpServers: {
            baton: {
                command: nodeBin,
                args: [serverScript],
                env: {
                    BATON_API_URL: apiUrl,
                    BATON_API_KEY: apiKey,
                    BATON_ORG_ID: orgId,
                    BATON_REPOSITORY_ID: repoId,
                    BATON_REPO_PATH: root
                }
            }
        }
    };
    // Claude Code .mcp.json
    await fs.writeFile(path.join(root, '.mcp.json'), JSON.stringify(mcpConfig, null, 2));
    // Cursor .cursor/mcp.json
    await fs.mkdir(path.join(root, '.cursor'), { recursive: true });
    await fs.writeFile(path.join(root, '.cursor', 'mcp.json'), JSON.stringify(mcpConfig, null, 2));
    // Antigravity .antigravity/mcp.json
    await fs.mkdir(path.join(root, '.antigravity'), { recursive: true });
    await fs.writeFile(path.join(root, '.antigravity', 'mcp.json'), JSON.stringify(mcpConfig, null, 2));
    console.log(` Generated MCP client configs (.mcp.json, .cursor/mcp.json, .antigravity/mcp.json)`);
    // 3. Claude Code Stop hook in .claude/settings.json
    try {
        const claudeSettingsDir = path.join(root, '.claude');
        await fs.mkdir(claudeSettingsDir, { recursive: true });
        const claudeSettingsPath = path.join(claudeSettingsDir, 'settings.json');
        let settings = {};
        try {
            settings = JSON.parse(await fs.readFile(claudeSettingsPath, 'utf8'));
        }
        catch { }
        settings.hooks = settings.hooks || {};
        settings.hooks.Stop = [
            { hooks: [{ type: 'command', command: `node "${path.join(root, 'mcp-server/dist/cli.js')}" sync --transcripts` }] }
        ];
        await fs.writeFile(claudeSettingsPath, JSON.stringify(settings, null, 2));
        console.log(` Configured Claude Code Stop hook: ${claudeSettingsPath}`);
    }
    catch { }
    // 4. Run first backfill
    console.log('\n Running initial baseline backfill (baton sync --all)...');
    const commitRes = await syncCommit('HEAD').catch(() => ({ commitSha: 'none', filesSynced: 0 }));
    const transRes = await syncTranscripts().catch(() => ({ messagesSynced: 0 }));
    console.log(` Backfill complete: Commit [${commitRes.commitSha.slice(0, 8)}] (${commitRes.filesSynced} files indexed), ${transRes.messagesSynced} transcript turns synced.`);
    console.log('\n Baton MCP Memory System is ready for live use!\n');
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
  baton init                  One-time setup (writes config, installs git hook, generates MCP settings)
  baton sync --commit [ref]   Push commit metadata and changed-file summaries (default: HEAD)
  baton sync --transcripts    Extract and push new turns from local agent sessions (Claude Code, Antigravity)
  baton sync --all            Perform full synchronization of latest commit, files, and transcripts
`);
        return;
    }
    if (command === 'init') {
        await initProject();
        return;
    }
    if (command === 'mcp' || command === 'serve' || command === 'start') {
        await import('./index.js');
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
main().catch((err) => {
    console.error('[Baton CLI Error]', err?.message || err);
    process.exit(1);
});
