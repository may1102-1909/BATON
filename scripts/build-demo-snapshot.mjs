// Writes src/pages/demoSnapshot.json from the public GitHub API (set GITHUB_TOKEN to avoid the 60 requests/hour limit).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REPO = process.env.DEMO_REPO || 'may1102-1909/BATON';
const MAX_COMMITS = 100;
const MAX_FILES = 25;
const OUTPUT = fileURLToPath(new URL('../src/pages/demoSnapshot.json', import.meta.url));
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'baton-demo-snapshot' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

let remaining = Infinity;
async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers });
  remaining = Number(response.headers.get('x-ratelimit-remaining') ?? remaining);
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`);
  return response.json();
}

const scrubText = (text, limit) => String(text ?? '')
  .split('\n').filter(line => !/^co-authored-by:/i.test(line.trim())).join('\n')
  .replace(/[^\s<>]+@[^\s<>]+/g, '').replace(/<\s*>/g, '').trim().slice(0, limit);
const login = user => user?.login ?? null;

const [contributors, commitList, pullList, branchList, repository] = await Promise.all([
  api('/contributors?per_page=30'), api(`/commits?per_page=${MAX_COMMITS}`),
  api('/pulls?state=all&per_page=50'), api('/branches?per_page=50'), api(''),
]);
const base = repository.default_branch;

// Commit file lists need one request each; stop before exhausting an unauthenticated limit.
const commits = [];
for (const item of commitList.slice(0, MAX_COMMITS)) {
  let files = [];
  if (remaining > 30) {
    const detail = await api(`/commits/${item.sha}`);
    files = (detail.files ?? []).slice(0, MAX_FILES).map(file => file.filename);
  }
  commits.push({
    sha: item.sha, author_login: login(item.author) ?? 'unknown', message: scrubText(item.commit?.message, 400),
    date: item.commit?.author?.date, url: item.html_url, files,
  });
}

const pulls = [];
for (const pr of pullList) {
  const files = remaining > 30 ? (await api(`/pulls/${pr.number}/files?per_page=${MAX_FILES}`)).map(file => file.filename) : [];
  pulls.push({
    number: pr.number, title: scrubText(pr.title, 200), body: scrubText(pr.body, 300), state: pr.state, merged: Boolean(pr.merged_at),
    head: pr.head?.ref ?? null, base: pr.base?.ref ?? base, author_login: login(pr.user) ?? 'unknown', created_at: pr.created_at, url: pr.html_url, files,
  });
}

const branches = [];
for (const branch of branchList.filter(item => item.name !== base)) {
  const compare = remaining > 10 ? await api(`/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch.name)}`) : {};
  branches.push({
    name: branch.name, base, sha: branch.commit.sha, ahead_by: compare.ahead_by ?? 0, behind_by: compare.behind_by ?? 0,
  });
}

let agents = '';
try {
  const file = await api('/contents/AGENTS.md');
  agents = scrubText(Buffer.from(file.content ?? '', 'base64').toString('utf8').split(/^---$/m)[0], 600);
} catch { /* optional */ }

const snapshot = {
  repository: REPO, default_branch: base, generated_at: new Date().toISOString(),
  contributors: contributors.map(item => ({ login: item.login, contributions: item.contributions, type: item.type })),
  commits, pulls, branches, agents,
};
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`Wrote ${OUTPUT}: ${commits.length} commits, ${pulls.length} pull requests, ${branches.length} branches`);
