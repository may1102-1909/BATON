export const RISK_WEIGHTS = { bus_factor_one: 40, unmerged_branch: 30, leaver_open_pr: 20, blocker: 20, stale: 10, conflict: 15 };
export const HIGH_AT = 60;
export const MEDIUM_AT = 30;
export const ALERT_MIN_CHANGES = 3;
const STALE_DAYS = 30;

const trim = value => (typeof value === 'string' ? value.trim() : '');
const lower = value => trim(value).toLowerCase();
const metadata = source => source?.metadata && typeof source.metadata === 'object' ? source.metadata : {};
const aheadBy = source => lower(source.type) === 'branch' && Number(metadata(source).ahead_by) > 0 ? Math.floor(Number(metadata(source).ahead_by)) : 0;
const touched = source => Date.parse(metadata(source).updated_at ?? source.updated_at ?? source.created_at ?? '') || null;

export const riskLabel = score => (score >= HIGH_AT ? 'high' : score >= MEDIUM_AT ? 'medium' : 'low');

// "server/handover.js" -> "server"; "src/components/X.jsx" -> "src/components"; root files -> "(root)".
export function moduleOf(path) {
  const segments = trim(String(path ?? '')).replace(/^\.?\/+/, '').split('/').filter(Boolean);
  return segments.length < 2 ? '(root)' : segments.slice(0, Math.min(2, segments.length - 1)).join('/');
}

export function filesOf(source) {
  const meta = metadata(source);
  const names = [
    ...(Array.isArray(meta.files) ? meta.files : []),
    ...['added', 'modified', 'removed'].flatMap(key => Array.isArray(meta[key]) ? meta[key] : []),
  ].map(file => trim(typeof file === 'string' ? file : file?.filename ?? file?.path));
  return [...new Set(names.filter(Boolean))];
}

export function contributorOf(source, members = []) {
  const login = trim(source.author_login ?? metadata(source).author_login);
  if (/\[bot\]$/i.test(login)) return null;
  const authorId = trim(source.author_id == null ? '' : String(source.author_id));
  const member = members.find(item => !item.disabled_at && login && lower(item.github_login) === login.toLowerCase())
    ?? members.find(item => !item.disabled_at && authorId && item.user_id === authorId);
  if (member) return { id: member.user_id, user_id: member.user_id, login: member.github_login ?? (login || null), name: member.name || member.github_login || login || 'Team member' };
  const key = login || authorId;
  return key ? { id: key, user_id: null, login: login || null, name: login || key } : null;
}

export function aggregateModules(sources, members = []) {
  const byModule = new Map();
  for (const source of sources.filter(item => ['commit', 'pull_request'].includes(lower(item.type)))) {
    const person = contributorOf(source, members);
    if (!person) continue;
    const stamp = touched(source);
    for (const module of new Set(filesOf(source).map(moduleOf))) {
      const entry = byModule.get(module) ?? { module, changes: 0, last_touched: null, people: new Map() };
      const count = filesOf(source).filter(file => moduleOf(file) === module).length;
      entry.changes += count;
      if (stamp && (!entry.last_touched || stamp > Date.parse(entry.last_touched))) entry.last_touched = new Date(stamp).toISOString();
      const row = entry.people.get(person.id) ?? { ...person, changes: 0 };
      row.changes += count;
      entry.people.set(person.id, row);
      byModule.set(module, entry);
    }
  }
  const modules = [...byModule.values()].map(entry => {
    const contributors = [...entry.people.values()].sort((a, b) => b.changes - a.changes || String(a.name).localeCompare(String(b.name)))
      .map(person => ({ ...person, share: Math.round((person.changes / entry.changes) * 1000) / 1000 }));
    let covered = 0;
    let busFactor = 0;
    for (const person of contributors) { covered += person.changes; busFactor += 1; if (covered * 2 >= entry.changes) break; }
    return { module: entry.module, changes: entry.changes, last_touched: entry.last_touched, contributors, bus_factor: busFactor };
  }).sort((a, b) => b.changes - a.changes || a.module.localeCompare(b.module));
  const people = new Map();
  for (const module of modules) for (const person of module.contributors) people.set(person.id, { id: person.id, name: person.name });
  const contributors = [...people.values()];
  const matrix = {
    contributors, modules: modules.map(item => item.module),
    cells: contributors.map(person => modules.map(module => module.contributors.find(item => item.id === person.id)?.changes ?? 0)),
  };
  const alerts = modules.filter(item => item.changes >= ALERT_MIN_CHANGES && item.contributors.length === 1).map(item => ({
    module: item.module, sole_contributor: { id: item.contributors[0].id, name: item.contributors[0].name }, changes: item.changes,
    message: `${item.contributors[0].name} made all ${item.changes} recorded changes in ${item.module}. If they leave, no one else has recent context there.`,
  }));
  return { modules, matrix, alerts };
}

export function isLeaverSource(source, leaver = {}) {
  const login = lower(source.author_login ?? metadata(source).author_login);
  return Boolean((source.author_id && leaver.ids?.has(String(source.author_id))) || (login && leaver.logins?.has(login)));
}

// Pure: ctx = { now, alertModules: Map<module, alert>, leaver: { ids, logins }, conflictSourceIds: Set }.
export function scoreGap(gap, ctx = {}) {
  const sources = gap.sources ?? [];
  const reasons = [];
  let score = 0;
  const add = (points, reason) => { score += points; reasons.push(reason); };
  const modules = new Set([...(gap.modules ?? []), ...sources.flatMap(source => filesOf(source).map(moduleOf))]);
  const alert = [...modules].map(module => ctx.alertModules?.get(module)).find(Boolean);
  if (alert) add(RISK_WEIGHTS.bus_factor_one, `Bus factor 1: only ${alert.sole_contributor.name} has changed ${alert.module} (${alert.changes} changes)`);
  const branch = sources.find(source => aheadBy(source) > 0);
  if (branch) add(RISK_WEIGHTS.unmerged_branch, `Branch ${trim(metadata(branch).name) || 'unnamed'} is ${aheadBy(branch)} commit(s) ahead of ${trim(metadata(branch).base) || 'its base'} and unmerged`);
  const pull = sources.find(source => lower(source.type) === 'pull_request' && lower(metadata(source).state) === 'open' && isLeaverSource(source, ctx.leaver));
  if (pull) add(RISK_WEIGHTS.leaver_open_pr, `Outgoing member's pull request ${metadata(pull).number ? `#${metadata(pull).number} ` : ''}is still open`);
  if (sources.some(source => lower(source.type) === 'blocker' && lower(metadata(source).status ?? metadata(source).state) !== 'resolved')) add(RISK_WEIGHTS.blocker, 'Unresolved blocker');
  const stamps = sources.map(touched).filter(Boolean);
  const now = ctx.now ?? Date.now();
  if (stamps.length && stamps.length === sources.length && stamps.every(stamp => now - stamp > STALE_DAYS * 86400000)) add(RISK_WEIGHTS.stale, `Untouched for more than ${STALE_DAYS} days`);
  if (gap.conflict || sources.some(source => ctx.conflictSourceIds?.has(source.id))) add(RISK_WEIGHTS.conflict, `Sources disagree about ${gap.conflict_subject || 'this item'}`);
  score = Math.min(100, score);
  return { score, label: riskLabel(score), reasons };
}
