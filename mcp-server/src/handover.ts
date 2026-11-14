import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { exportHandoverMarkdown } from './api.js';

const execFileAsync = promisify(execFile);

async function repositoryRoot(): Promise<string> {
  const configured = process.env.BATON_REPO_PATH?.trim();
  const cwd = configured ? path.resolve(configured) : process.cwd();
  const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { timeout: 5000, maxBuffer: 64 * 1024 });
  return fs.realpath(stdout.trim());
}

/** Resolves a repository-relative Markdown path and refuses anything that escapes the repository or touches .git. */
export async function resolveHandoverPath(root: string, outputPath: string | undefined, handoverId: string): Promise<string> {
  const fallback = `docs/handovers/handover-${handoverId.replace(/[^A-Za-z0-9-]/g, '').slice(0, 8) || 'packet'}.md`;
  const relative = (outputPath?.trim() || fallback).replaceAll('\\', '/');
  if (path.isAbsolute(relative) || relative.split('/').some(part => part === '..' || part === '.git')) {
    throw new Error('output_path must be a relative path inside the repository.');
  }
  if (!/\.md$/i.test(relative)) throw new Error('output_path must end in .md');
  const target = path.resolve(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const parent = await fs.realpath(path.dirname(target));
  if (parent !== root && !parent.startsWith(root + path.sep)) throw new Error('output_path resolves outside the repository.');
  const existing = await fs.lstat(target).catch(() => null);
  if (existing?.isSymbolicLink()) throw new Error('output_path is a symbolic link; refusing to overwrite it.');
  return path.join(parent, path.basename(target));
}

/** Downloads the approved handover packet and writes it into the repository as a Markdown file. */
export async function exportHandoverFile(handoverId?: string, outputPath?: string) {
  const exported = await exportHandoverMarkdown(handoverId);
  if (!exported.success || !exported.data) return { success: false, message: exported.message };
  try {
    const root = await repositoryRoot();
    const file = await resolveHandoverPath(root, outputPath, exported.data.handoverId);
    await fs.writeFile(file, exported.data.markdown.endsWith('\n') ? exported.data.markdown : `${exported.data.markdown}\n`, 'utf8');
    return {
      success: true,
      message: `Handover packet written to ${path.relative(root, file)}.`,
      data: { handoverId: exported.data.handoverId, path: path.relative(root, file), bytes: Buffer.byteLength(exported.data.markdown) }
    };
  } catch (error) {
    return {
      success: false,
      message: `Exported the handover but could not write the file: ${error instanceof Error ? error.message : 'unknown error'}`,
      data: { handoverId: exported.data.handoverId, markdown: exported.data.markdown }
    };
  }
}
