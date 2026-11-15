// Demo only: reads the workspace records (commits, pull requests, branches, decisions, blockers) and derives
// the leaver's interview answers and the exported handover document. Nothing here is fixed text about the
// repository; every figure comes from the records passed in, so a sync changes the output.
import { contributorOf, filesOf, moduleOf } from './risk.js';

const lower = value => String(value ?? '').toLowerCase();
const day = value => (value ? String(value).slice(0, 10) : 'unknown date');
const subjectOf = source => String(source?.metadata?.title ?? source?.content ?? '').split('\n')[0].replace(/^PR #\d+:\s*/, '').trim();
const isSample = source => /^\[SAMPLE\]/.test(String(source?.content ?? ''));
const byDateDesc = (a, b) => (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0);

const DEPENDENCY_RULES = [
  { name: 'Supabase (Postgres, pgvector, auth)', test: file => /^supabase\//.test(file) || /(^|\/)store\.js$/.test(file) || /(^|\/)supabase\.js$/.test(file), role: 'database, row-level security, vector search and sign-in' },
  { name: 'GitHub App and GitHub API', test: file => /github/i.test(file), role: 'repository connect, history sync and webhooks' },
  { name: 'Google Gemini', test: file => /gemini/i.test(file), role: 'drafting claims and embeddings; Baton falls back to evidence-only output without it' },
  { name: 'Vercel', test: file => /^vercel\.json$/.test(file) || /^api\//.test(file), role: 'hosting and the serverless API entry point' },
  { name: 'Baton MCP server (stdio, npx)', test: file => /^mcp-server\//.test(file), role: 'what agents run locally; the committed mcp-server/dist must match its source' },
  { name: 'GitHub Actions CI', test: file => /^\.github\/workflows\//.test(file), role: 'build, unit tests, MCP build drift check and Playwright on every pull request' },
  { name: 'Playwright', test: file => /^e2e\//.test(file) || /playwright/.test(file), role: 'end-to-end browser tests' },
];

export function analyzeWorkspace({ sources = [], members = [], tasks = [] } = {}) {
  const commits = sources.filter(s => s.type === 'commit').sort(byDateDesc);
  const pulls = sources.filter(s => s.type === 'pull_request').sort(byDateDesc);
  const branches = sources.filter(s => s.type === 'branch');
  const nameOf = source => contributorOf(source, members)?.name ?? source?.author_login ?? 'unknown author';

  const people = new Map();
  for (const source of [...commits, ...pulls]) {
    const who = contributorOf(source, members);
    if (!who) continue;
    const entry = people.get(who.name) ?? { name: who.name, login: who.login, commits: 0, pulls: 0, modules: new Set() };
    if (source.type === 'commit') entry.commits += 1; else entry.pulls += 1;
    for (const file of filesOf(source)) entry.modules.add(moduleOf(file));
    people.set(who.name, entry);
  }

  const modules = new Map();
  for (const commit of commits) {
    const who = contributorOf(commit, members)?.name;
    if (!who) continue;
    for (const file of filesOf(commit)) {
      const name = moduleOf(file);
      const entry = modules.get(name) ?? { name, changes: 0, commitIds: new Set(), people: new Map(), files: new Map(), last: null };
      if (!entry.commitIds.has(commit.id)) {
        entry.commitIds.add(commit.id);
        entry.changes += 1;
        entry.people.set(who, (entry.people.get(who) ?? 0) + 1);
        if (!entry.last || commit.created_at > entry.last) entry.last = commit.created_at;
      }
      entry.files.set(file, (entry.files.get(file) ?? 0) + 1);
      modules.set(name, entry);
    }
  }
  const moduleList = [...modules.values()]
    .map(entry => ({
      name: entry.name, changes: entry.changes, last: entry.last,
      people: [...entry.people].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      files: [...entry.files].sort((a, b) => b[1] - a[1]).map(([file]) => file),
    }))
    .sort((a, b) => b.changes - a.changes);

  const allFiles = [...new Set(commits.flatMap(filesOf))];
  const dependencies = DEPENDENCY_RULES.map(rule => {
    const files = allFiles.filter(rule.test);
    const touching = commits.filter(commit => filesOf(commit).some(rule.test));
    return { name: rule.name, role: rule.role, files, changes: touching.length, last: touching[0]?.created_at ?? null };
  }).filter(dep => dep.files.length > 0);

  const dated = [...commits, ...pulls].map(s => s.created_at).filter(Boolean).sort();
  return {
    commits, pulls, branches,
    realCommits: commits.filter(s => !isSample(s)),
    openPulls: pulls.filter(pr => pr.metadata?.state === 'open'),
    mergedPulls: pulls.filter(pr => pr.metadata?.merged),
    branchesAhead: branches.filter(b => Number(b.metadata?.ahead_by) > 0),
    decisions: sources.filter(s => s.type === 'decision'),
    blockers: sources.filter(s => s.type === 'blocker' && !['resolved', 'closed'].includes(lower(s.metadata?.status))),
    people: [...people.values()].sort((a, b) => (b.commits + b.pulls) - (a.commits + a.pulls)),
    modules: moduleList,
    singleOwner: moduleList.filter(m => m.people.length === 1 && m.changes >= 3),
    dependencies,
    migrations: allFiles.filter(file => /^supabase\/migrations\//.test(file)).sort(),
    openTasks: tasks.filter(task => task.status !== 'done' && task.status !== 'closed'),
    period: { from: dated[0] ?? null, to: dated[dated.length - 1] ?? null },
    nameOf, subjectOf, isSample, day,
  };
}

const list = (items, max = 4) => {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return shown.join(', ') + (rest > 0 ? ` and ${rest} more` : '');
};

/** The leaving engineer's answer to one exit-interview question, written from the workspace records. */
export function composeInterviewAnswer(question, analysis, { sourcesById = new Map(), leaverName = 'I', incomingName = 'the incoming engineer' } = {}) {
  const text = String(question?.question_text ?? '');
  const cited = (question?.source_ids ?? []).map(id => sourcesById.get(id)).filter(Boolean);
  const reviewer = analysis.people.find(person => person.name !== leaverName);

  const sole = /only recorded contributor to (\S+?) \((\d+) changes?\)/i.exec(text);
  if (sole) {
    const files = [...new Set(cited.flatMap(filesOf))];
    const subjects = cited.map(item => subjectOf(item).replace(/^\[SAMPLE\]\s*/, '').replace(/\s*\(.*\)\.?$/, '').replace(/\.$/, '')).filter(Boolean);
    return [
      `${sole[1]} is mine end to end (${list(subjects, 3)}).`,
      files.length ? `Read ${list(files, 4)} first; together they hold the whole flow.` : '',
      reviewer ? `${reviewer.name} has the most history elsewhere in the repository (${reviewer.commits} commits) and is the best second reviewer until ${incomingName} has shipped a change here.` : '',
    ].filter(Boolean).join(' ');
  }

  const blocker = /next step for this blocker:\s*(.+?)\??$/i.exec(text);
  if (blocker) {
    const source = cited.find(item => item.type === 'blocker');
    const status = source?.metadata?.status ?? 'active';
    const notes = source?.metadata?.workaround_notes;
    return `Still ${status}. Ownership moves from ${leaverName} to ${incomingName} with this handover. ${notes ? `Current workaround: ${notes} ` : ''}Next step: confirm the fix with the person who raised it before closing the blocker in Baton.`;
  }

  const disagree = /Sources disagree about (.+?):\s*(.+?) says (\d{4}-\d{2}-\d{2}),\s*(.+?) says (\d{4}-\d{2}-\d{2})/i.exec(text);
  if (disagree) {
    const [, subject, firstLabel, firstDate, secondLabel, secondDate] = disagree;
    const [winLabel, loseLabel] = secondDate > firstDate ? [secondLabel, firstLabel] : [firstLabel, secondLabel];
    // No dates in the answer: the engine reads dates in interview answers as another side of the conflict.
    const undated = text => String(text).replace(/^\[SAMPLE\]\s*/, '').replace(/\b(to|on|by)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Z][a-z]{2,8}|[A-Z][a-z]{2,8}\s+\d{1,2})\b/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim().replace(/\.$/, '');
    const note = cited.map(item => String(item.content ?? '')).find(content => content && !/ is due \d{4}-\d{2}-\d{2}/.test(content));
    return `The ${winLabel} is correct for ${undated(subject)}${note ? `: ${undated(note).replace(/^./, ch => ch.toLowerCase())}` : ''}. The ${loseLabel} was never updated afterwards.`;
  }

  if (/unfinished review or merge work/i.test(text)) {
    if (!analysis.openPulls.length && !analysis.branchesAhead.length) {
      const last = analysis.mergedPulls[0];
      return `No. All ${analysis.pulls.length} pull requests in the synced history are closed or merged, and no branch is ahead of its base.${last ? ` The last merge was PR #${last.metadata?.number} "${subjectOf(last)}" on ${day(last.created_at)}.` : ''}`;
    }
    const open = analysis.openPulls.map(pr => `PR #${pr.metadata?.number} "${subjectOf(pr)}"`);
    const ahead = analysis.branchesAhead.map(b => `${b.metadata?.name} (${b.metadata?.ahead_by} ahead)`);
    return `Yes: ${[...open, ...ahead].join('; ')}. Each needs a decision to merge or close before ${incomingName} takes over.`;
  }

  if (/dependencies, services, or external systems/i.test(text)) {
    if (!analysis.dependencies.length) return 'No external services appear in the synced changes.';
    return analysis.dependencies.map(dep => `${dep.name}: ${dep.role} (${dep.changes} commits, last ${day(dep.last)})`).join('. ') + '.';
  }

  if (/verify first/i.test(text)) {
    const top = analysis.modules[0];
    const steps = [
      top ? `run the tests that cover ${top.name}, the most-changed area (${top.changes} commits, last ${day(top.last)})` : null,
      analysis.migrations.length ? `confirm the newest migration (${analysis.migrations[analysis.migrations.length - 1]}) is applied in production` : null,
      analysis.blockers.length ? `walk through the ${analysis.blockers.length} open blocker${analysis.blockers.length === 1 ? '' : 's'} with ${reviewer?.name ?? 'the admin'}` : null,
    ].filter(Boolean);
    return steps.length ? `First, ${steps.join('; then ')}.` : 'First, sync the repository and read the most recent commits.';
  }

  if (/context is missing/i.test(text)) {
    const thin = analysis.singleOwner.map(m => m.name);
    return `${analysis.decisions.length} decisions are recorded against ${analysis.realCommits.length} commits, so most reasoning still lives in commit messages and pull request descriptions.${thin.length ? ` Areas with a single contributor and no second reviewer: ${list(thin, 5)}.` : ''}`;
  }

  const first = cited[0];
  return first ? `See ${subjectOf(first)} (${day(first.created_at)}); nothing else on record changes it.` : 'Nothing beyond the synced records.';
}
