import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pushMemory } from './api.js';
import { redactData, redactString } from './redact.js';

const execFileAsync = promisify(execFile);
const MAX_TRACKED = 1200;
const MAX_READ = 200;
const MAX_FILE_BYTES = 48 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_INVENTORY = 800;
const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.baton');
const CACHE_FILE = path.join(CACHE_DIR, 'snapshot.json');
const SECRET_PATH = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|secrets?(?:\.[^/]*)?|credentials?(?:\.[^/]*)?|id_rsa|id_ed25519)(?:\/|$)/i;
const SENSITIVE_EXTENSION = /\.(?:env|pem|key|crt|cer|p12|pfx|keystore)$/i;
const BUILD_PATH = /(^|\/)(?:node_modules|dist|build|target|coverage|\.next|\.turbo)(?:\/|$)/i;
const BINARY_PATH = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|wasm|exe|dll|so|dylib|class|jar|woff2?|ttf|otf|mp[34]|sqlite3?)$/i;

interface SnapshotState {
  root_id: string;
  files: Record<string, string>;
  inventory: string[];
}

function digest(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function safePath(relative: string): boolean {
  const normalized = relative.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((part) => part === '..' || part === '.git')) return false;
  if (SECRET_PATH.test(normalized) || SENSITIVE_EXTENSION.test(normalized) || BUILD_PATH.test(normalized) || BINARY_PATH.test(normalized)) return false;
  return true;
}

async function resolveRepository(): Promise<string> {
  const configured = process.env.BATON_REPO_PATH?.trim();
  if (!configured) throw new Error('BATON_REPO_PATH must point to the repository to snapshot.');
  const root = await fs.realpath(path.resolve(configured));
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error('BATON_REPO_PATH is not a directory.');
  const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { timeout: 5000, maxBuffer: 64 * 1024 });
  const gitRoot = await fs.realpath(stdout.trim());
  if (gitRoot !== root) throw new Error('BATON_REPO_PATH must be the Git repository root.');
  return root;
}

async function loadCache(): Promise<SnapshotState | undefined> {
  try {
    const dirStat = await fs.lstat(CACHE_DIR);
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) throw new Error('Unsafe local snapshot cache directory.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    const stat = await fs.lstat(CACHE_FILE);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe local snapshot cache file.');
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SnapshotState;
    if (!parsed || typeof parsed.files !== 'object' || !parsed.files || Array.isArray(parsed.files) || typeof parsed.root_id !== 'string' || !Array.isArray(parsed.inventory)) throw new Error('Invalid local snapshot cache.');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function saveCache(state: SnapshotState): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true, mode: 0o700 });
  const dirStat = await fs.lstat(CACHE_DIR);
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) throw new Error('Unsafe local snapshot cache directory.');
  const temp = path.join(CACHE_DIR, `.snapshot-${randomUUID()}.tmp`);
  await fs.writeFile(temp, JSON.stringify(state), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await fs.rename(temp, CACHE_FILE);
  await fs.chmod(CACHE_FILE, 0o600);
}

async function trackedFiles(root: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'buffer', timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
  return stdout.toString().split('\0').filter(Boolean).slice(0, MAX_TRACKED).filter(safePath).sort();
}

async function readTrackedFile(root: string, relative: string, remainingBytes: number): Promise<Buffer | undefined> {
  const candidate = path.resolve(root, relative);
  if (!isInside(root, candidate)) return undefined;
  try {
    const real = await fs.realpath(candidate);
    if (!isInside(root, real)) return undefined;
    const stat = await fs.stat(real);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES || stat.size > remainingBytes) return undefined;
    return await fs.readFile(real);
  } catch {
    return undefined;
  }
}

function architectureSummary(files: string[], contents: Map<string, Buffer>): Record<string, unknown> {
  const headings: string[] = [];
  for (const [name, value] of contents) {
    if (!/^README(?:\.[^/]*)?$/i.test(path.posix.basename(name))) continue;
    for (const line of value.toString('utf8').split(/\r?\n/)) {
      const heading = line.trim();
      if (/^#{1,4}\s+/.test(heading)) headings.push(redactString(heading.slice(0, 200)));
      if (headings.length >= 20) break;
    }
  }
  return {
    tracked_file_count: files.length,
    inventory: files.slice(0, MAX_INVENTORY).map(redactString),
    inventory_truncated: files.length > MAX_INVENTORY,
    read_limit: MAX_READ,
    file_size_limit_bytes: MAX_FILE_BYTES,
    architecture_hints: headings
  };
}

export async function bootstrapProject(): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const root = await resolveRepository();
    const files = await trackedFiles(root);
    const loaded = await loadCache();
    const rootId = digest(Buffer.from(root));
    const previous = loaded?.root_id === rootId ? loaded : undefined;
    const hashes: Record<string, string> = {};
    const contents = new Map<string, Buffer>();
    let totalBytes = 0;
    for (const relative of files.slice(0, MAX_READ)) {
      const content = await readTrackedFile(root, relative, MAX_TOTAL_BYTES - totalBytes);
      if (!content) continue;
      totalBytes += content.byteLength;
      const hash = digest(content);
      hashes[relative] = hash;
      if (/^README(?:\.[^/]*)?$|^(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml)$/i.test(path.posix.basename(relative))) {
        contents.set(relative, content.subarray(0, 24 * 1024));
      }
    }

    const oldFiles = previous?.files ?? {};
    const changed = Object.entries(hashes)
      .filter(([name, hash]) => oldFiles[name] !== hash)
      .map(([pathName, hash]) => ({ path: redactString(pathName), sha256: hash, change: oldFiles[pathName] ? 'modified' : 'added' }));
    const removed = (previous?.inventory ?? Object.keys(oldFiles)).filter((name) => !files.includes(name)).slice(0, MAX_READ)
      .map((name) => ({ path: redactString(name), change: 'removed' }));
    if (previous && changed.length === 0 && removed.length === 0 && JSON.stringify(files) === JSON.stringify(previous.inventory)) {
      return {
        success: true,
        message: 'Scanned tracked files are unchanged; no backend request was made.',
        data: { unchanged: true, tracked_file_count: files.length, scanned_file_count: Object.keys(hashes).length, scan_incomplete: files.length > Object.keys(hashes).length }
      };
    }

    const snapshot = redactData({
      summary: architectureSummary(files, contents),
      changed_files: [...changed, ...removed],
      scanned_file_count: Object.keys(hashes).length,
      scan_incomplete: files.length > Object.keys(hashes).length,
      read_count_limit: MAX_READ,
      byte_limit: MAX_TOTAL_BYTES
    });
    const stored = await pushMemory('bootstrap', snapshot);
    if (!stored.success) return stored;
    await saveCache({ root_id: rootId, files: hashes, inventory: files });
    return {
      success: true,
      message: previous ? 'Incremental tracked-file changes were sent to Baton.' : 'Initial safe tracked-file snapshot was sent to Baton.',
      data: {
        tracked_file_count: files.length,
        scanned_file_count: Object.keys(hashes).length,
        changed_file_count: changed.length + removed.length,
        scan_incomplete: files.length > Object.keys(hashes).length,
        initial_snapshot: !previous
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Snapshot failed.';
    return { success: false, message: redactString(message) };
  }
}
