// Browser side of Baton Demo Mode (/demo-page). State lives in this browser only; every API call is
// answered by the real engine through POST /api/demo (server/demo.js), which keeps nothing and uses no credentials.
import snapshot from './demoSnapshot.json' with { type: 'json' }

const STORAGE_KEY = 'baton_demo_state_v3'
const LEGACY_STORAGE_KEY = 'baton_demo_state_v2'
const ORG_ID = 'demo-org'
const REPO_ID = 'demo-repo'
const DEMO_INSTALLATION_ID = 'demo-installation'
const ADMIN_LOGIN = 'may1102-1909'
const SEED_DATE = '2026-11-01T10:00:00Z'
const PRODUCTION_ONLY = 'Available in Production mode'

const isBot = login => !login || login === 'unknown' || login.endsWith('[bot]')
const toFiles = list => (list ?? []).map(filename => ({ filename }))

// Commits, pull requests and branches in the snapshot shape become engine "sources".
export function sourcesFromSnapshot(data, repoId = REPO_ID) {
  const repo = data.repository
  const common = { org_id: ORG_ID, repository_id: repoId, author_id: null, visibility: 'team' }
  const sources = []
  for (const commit of data.commits ?? []) {
    sources.push({
      ...common, id: `gh-commit-${commit.sha.slice(0, 12)}`, external_id: `github:${repo}:commit:${commit.sha}`,
      author_login: commit.author_login, type: 'commit', content: String(commit.message ?? '').slice(0, 500), url: commit.url,
      metadata: { kind: 'commit', sha: commit.sha, author_login: commit.author_login, url: commit.url, repository: repo, audience: ['all'], ...(commit.files ? { files: toFiles(commit.files) } : {}) },
      created_at: commit.date
    })
  }
  for (const pr of data.pulls ?? []) {
    sources.push({
      ...common, id: `gh-pr-${pr.number}`, external_id: `github:${repo}:pull_request:${pr.number}`,
      author_login: pr.author_login, type: 'pull_request', content: `PR #${pr.number}: ${pr.title}`, url: pr.url,
      metadata: {
        kind: 'pull_request', number: pr.number, title: pr.title, state: pr.state, merged: Boolean(pr.merged), head: pr.head,
        base_ref: pr.base, author_login: pr.author_login, url: pr.url, repository: repo, audience: ['all'], ...(pr.files ? { files: toFiles(pr.files) } : {})
      },
      created_at: pr.created_at
    })
  }
  for (const branch of data.branches ?? []) {
    sources.push({
      ...common, id: `gh-branch-${branch.name}`, external_id: `github:${repo}:branch:${branch.name}`, author_login: null,
      type: 'branch', content: `Branch ${branch.name}: ${branch.ahead_by} ahead, ${branch.behind_by} behind ${branch.base}`,
      metadata: { kind: 'branch', name: branch.name, base: branch.base, ahead_by: branch.ahead_by, behind_by: branch.behind_by, sha: branch.sha, repository: repo, audience: ['all'] },
      created_at: data.generated_at
    })
  }
  return sources
}

// Leaver and incoming come from the real contributors, most active first.
function pickPeople(data) {
  const counts = new Map()
  const bump = login => { if (!isBot(login) && login !== ADMIN_LOGIN) counts.set(login, (counts.get(login) ?? 0) + 1) }
  for (const commit of data.commits ?? []) bump(commit.author_login)
  for (const pr of data.pulls ?? []) bump(pr.author_login)
  const [leaver, incoming] = [...counts].sort((a, b) => b[1] - a[1]).map(([login]) => login)
  return { leaver: leaver ?? null, incoming: incoming ?? null }
}

const people = pickPeople(snapshot)

export const DEMO_PERSONAS = [
  { id: 'demo-admin', name: 'May (Admin)', role: 'Team lead' },
  { id: 'demo-leaver', name: people.leaver ?? 'Leaving engineer', role: 'Leaving engineer' },
  { id: 'demo-incoming', name: people.incoming ?? 'Incoming engineer', role: 'Incoming engineer' }
]

export const DEMO_SIMULATOR_SAMPLE = {
  decision: '[SAMPLE] Rotate the deploy key after it appeared in a build log',
  reason: '[SAMPLE] The log contained ' + 'sk_' + 'live_SAMPLE00000000000000000000' + '. This is a made-up key to show redaction before anything is stored.'
}

export function getInitialDemoState() {
  const member = (id, user_id, name, role, github_login) => ({ id, org_id: ORG_ID, user_id, name, role, ...(github_login ? { github_login } : {}), created_at: SEED_DATE })
  const members = [
    member('m-admin', 'demo-admin', 'May (Admin)', 'admin', ADMIN_LOGIN),
    member('m-leaver', 'demo-leaver', `${DEMO_PERSONAS[1].name} (Leaving)`, 'member', people.leaver),
    { ...member('m-incoming', 'demo-incoming', `${DEMO_PERSONAS[2].name} (Incoming)`, 'member', people.incoming), function_role: 'backend' }
  ]
  const idFor = login => members.find(item => item.github_login === login)?.user_id ?? null
  const sources = sourcesFromSnapshot(snapshot)
  const now = snapshot.generated_at

  // Decisions: commits that record a choice, plus the project's own agent protocol.
  const choice = /^(feat|refactor)\b|\b(migrat|switch|replac|adopt)/i
  for (const commit of snapshot.commits.filter(item => choice.test(item.message)).slice(0, 6)) {
    const [subject, ...rest] = commit.message.split('\n').filter(Boolean)
    sources.push({
      id: `decision-${commit.sha.slice(0, 12)}`, org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(commit.author_login), author_login: commit.author_login,
      type: 'decision', content: `${subject}. ${rest.join(' ')}`.trim().slice(0, 400), visibility: 'team', created_at: commit.date,
      metadata: { decision: subject, reason: rest.join(' ').slice(0, 240) || `Recorded in commit ${commit.sha.slice(0, 7)}.`, files_affected: (commit.files ?? []).slice(0, 5) }
    })
  }
  sources.push({
    id: 'decision-agents-md', org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(ADMIN_LOGIN), author_login: ADMIN_LOGIN, type: 'decision',
    content: 'Agents record architectural decisions and blockers through the Baton MCP server (AGENTS.md).', visibility: 'team', created_at: now,
    metadata: { decision: 'Capture decisions with the Baton MCP server', reason: String(snapshot.agents ?? '').split('\n').filter(line => line && !line.startsWith('#'))[0] ?? 'Keeps context across agent sessions.', files_affected: ['AGENTS.md'] }
  })

  // Planted examples, labelled as samples because they are not part of the repository's history.
  sources.push(
    {
      id: 'sample-decision-a', org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(people.leaver), author_login: people.leaver, type: 'decision', visibility: 'team', created_at: now,
      content: '[SAMPLE] Keep the MCP collector local-only so no project data leaves the developer machine.',
      metadata: { decision: '[SAMPLE] Collector stays local-only', reason: 'Sample of one side of a conflict.', files_affected: ['mcp-server/'] }
    },
    {
      id: 'sample-decision-b', org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(ADMIN_LOGIN), author_login: ADMIN_LOGIN, type: 'decision', visibility: 'team', created_at: now,
      content: '[SAMPLE] Expose the MCP collector over HTTP so hosted agents can push decisions.',
      metadata: { decision: '[SAMPLE] Collector is exposed over HTTP', reason: 'Sample of the opposing side of a conflict.', files_affected: ['mcp-server/'] }
    },
    {
      id: 'sample-redaction', org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(people.leaver), author_login: people.leaver, type: 'decision', visibility: 'team', created_at: now,
      content: '[SAMPLE] Deploy notes mentioned an API key [REDACTED: API_KEY]; the raw value was scrubbed before it was stored.',
      metadata: { decision: '[SAMPLE] Redaction example', reason: 'Shows secrets never reach storage.', files_affected: [] }
    },
    {
      id: 'sample-blocker', org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(people.leaver), author_login: people.leaver, type: 'blocker', visibility: 'team', created_at: now,
      content: '[SAMPLE] Release waits for a review of the handover generation fallback.',
      metadata: { status: 'active', problem: '[SAMPLE] Handover fallback needs review', workaround_notes: 'Evidence-only mode is used until a model key is configured.' }
    },
    ...[['queue', ['src/webhooks/queue.js', 'src/webhooks/retry.js']], ['backoff', ['src/webhooks/retry.js']], ['signing', ['src/webhooks/signing.js']]].map(([name, files]) => ({
      id: `sample-commit-${name}`, org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(people.leaver), author_login: people.leaver, type: 'commit', visibility: 'team', created_at: now,
      content: `[SAMPLE] Webhook delivery ${name} work (only the leaving engineer has touched src/webhooks).`,
      metadata: { kind: 'commit', sha: `sample${name}`, author_login: people.leaver, repository: snapshot.repository, files: toFiles(files), audience: ['all'] }
    })),
    {
      id: 'sample-infra-blocker', org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(ADMIN_LOGIN), author_login: ADMIN_LOGIN, type: 'blocker', visibility: 'team', created_at: now,
      content: '[SAMPLE] Infra-only: the staging cluster certificate expires soon and only the Terraform state bucket credentials can rotate it.',
      metadata: { status: 'active', problem: '[SAMPLE] Infra-only certificate rotation', audience: ['infra'] }
    }
  )

  return {
    organizations: [{ id: ORG_ID, name: 'BATON Team · DEMO', created_by: 'demo-admin', created_at: SEED_DATE }],
    members,
    repositories: [{ id: REPO_ID, org_id: ORG_ID, full_name: snapshot.repository, installation_id: DEMO_INSTALLATION_ID, last_synced_at: now, demo: true, created_at: SEED_DATE }],
    sources,
    tasks: [{
      id: 'sample-task', org_id: ORG_ID, title: '[SAMPLE] Walk the incoming engineer through server/ and mcp-server/', description: 'Sample task for the handover story.',
      assignee_id: 'demo-leaver', created_by: 'demo-admin', status: 'open', due_at: '2026-11-10', created_at: SEED_DATE
    }],
    task_comments: [{
      id: 'sample-comment', org_id: ORG_ID, task_id: 'sample-task', author_id: 'demo-admin', parent_id: null, created_at: SEED_DATE,
      content: '[SAMPLE] Walkthrough moved to 15 Nov because the review slipped.'
    }],
    handovers: []
  }
}

export function loadDemoState() {
  if (typeof window === 'undefined') return getInitialDemoState()
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.removeItem('baton_demo_state')
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to load demo state from localStorage:', err)
  }
  const init = getInitialDemoState()
  saveDemoState(init)
  return init
}

export function saveDemoState(state) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Failed to save demo state to localStorage:', err)
  }
}

export function resetDemoState() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  return getInitialDemoState()
}

// Live refresh from GitHub's public API; the caller falls back to the snapshot when this fails.
async function readLiveRepo(fetchImpl) {
  const base = `https://api.github.com/repos/${snapshot.repository}`
  const read = async path => {
    const response = await fetchImpl.call(window, `${base}${path}`, { headers: { accept: 'application/vnd.github+json' } })
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
    return response.json()
  }
  const [commits, pulls] = await Promise.all([read('/commits?per_page=30'), read('/pulls?state=all&per_page=30')])
  return {
    repository: snapshot.repository,
    commits: commits.map(item => ({
      sha: item.sha, author_login: item.author?.login ?? 'unknown', message: String(item.commit?.message ?? '').replace(/[^\s<>]+@[^\s<>]+/g, '').slice(0, 400),
      date: item.commit?.author?.date, url: item.html_url
    })),
    pulls: pulls.map(pr => ({
      number: pr.number, title: pr.title, state: pr.state, merged: Boolean(pr.merged_at), head: pr.head?.ref ?? null, base: pr.base?.ref ?? null,
      author_login: pr.user?.login ?? 'unknown', created_at: pr.created_at, url: pr.html_url
    }))
  }
}

function mergeSources(state, incoming) {
  for (const source of incoming) {
    const index = state.sources.findIndex(item => item.external_id === source.external_id)
    if (index < 0) state.sources.push(source)
    else state.sources[index] = { ...state.sources[index], ...source, metadata: { ...state.sources[index].metadata, ...source.metadata } }
  }
}

let originalFetch = null
let currentPersona = 'demo-admin'
let queue = Promise.resolve()

export function setDemoPersona(personaId) {
  currentPersona = DEMO_PERSONAS.some(item => item.id === personaId) ? personaId : 'demo-admin'
}

export function isDemoRoute() {
  return typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/demo-page')
}

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

async function callEngine(persona, method, path, body) {
  const state = loadDemoState()
  let response
  try {
    response = await originalFetch.call(window, '/api/demo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, state, request: { method, path, body } })
    })
  } catch {
    return { status: 503, body: { error: 'The demo engine could not be reached' } }
  }
  if (!response.ok) return { status: 503, body: { error: 'The demo engine is unavailable right now' } }
  const result = await response.json()
  if (result.state) saveDemoState(result.state)
  return result
}

// The first visit opens with a handover generated from the repository data by the real engine.
async function ensureSeedHandover() {
  const state = loadDemoState()
  if (state.handovers?.length) return
  const started = await callEngine('demo-admin', 'POST', `/api/orgs/${ORG_ID}/handovers`, { leaverId: 'demo-leaver', incomingId: 'demo-incoming' })
  if (started.body?.handover) await callEngine('demo-admin', 'POST', `/api/handovers/${started.body.handover.id}/generate`)
}

async function syncRepository() {
  let data = snapshot
  try {
    data = await readLiveRepo(originalFetch)
  } catch { /* keep the bundled snapshot */ }
  const state = loadDemoState()
  const repo = state.repositories[0]
  mergeSources(state, sourcesFromSnapshot(data, repo.id))
  repo.last_synced_at = new Date().toISOString()
  saveDemoState(state)
  return { commits: data.commits.length, pullRequests: data.pulls.length, issues: 0 }
}

export function installDemoInterceptor(initialPersona = 'demo-admin') {
  if (typeof window === 'undefined') return
  if (originalFetch) return // already installed

  setDemoPersona(initialPersona)
  originalFetch = window.fetch

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : input?.url || ''

    // Demo data must never reach other pages such as /dashboard.
    if (!isDemoRoute()) {
      return originalFetch.apply(this, arguments)
    }

    // Only intercept requests directed to /api/ on the current origin
    if (!urlStr.startsWith('/api/') && !urlStr.includes('/api/')) {
      return originalFetch.apply(this, arguments)
    }

    const url = new URL(urlStr, window.location.origin)
    const pathname = url.pathname
    const method = (init.method || 'GET').toUpperCase()

    if (pathname === '/api/demo') return originalFetch.apply(this, arguments)

    if (pathname === '/api/health') {
      return reply({ ok: true, configured: { supabase: true, github: true, demo: true } })
    }

    // GitHub in the demo: the repository is already connected; sync reads the public API or the snapshot.
    if (pathname.match(/^\/api\/orgs\/[^/]+\/github\/connect$/)) return reply({ url: null, demo: true })
    if (pathname.match(/^\/api\/orgs\/[^/]+\/github\/installations$/)) {
      return reply([{ id: DEMO_INSTALLATION_ID, account: { login: snapshot.repository.split('/')[0], type: 'User' }, repository_selection: 'selected' }])
    }
    if (pathname.match(/^\/api\/orgs\/[^/]+\/github\/installations\/[^/]+\/repositories$/)) {
      return reply([{ full_name: snapshot.repository, private: false, default_branch: snapshot.default_branch }])
    }
    if (pathname.match(/^\/api\/orgs\/[^/]+\/repositories$/) && method === 'POST') {
      return reply(loadDemoState().repositories[0], 201)
    }
    if (pathname.match(/^\/api\/orgs\/[^/]+\/repositories\/[^/]+\/sync$/) && method === 'POST') {
      return reply(await syncRepository())
    }

    let body
    try { body = init.body ? JSON.parse(init.body) : undefined } catch { body = undefined }
    const persona = currentPersona
    // Requests are serialized so concurrent calls never overwrite each other's state.
    const run = queue.then(async () => {
      if (/^\/api\/orgs\/[^/]+\/state$/.test(pathname)) await ensureSeedHandover()
      return callEngine(persona, method, pathname + url.search, body)
    })
    queue = run.catch(() => {})
    const result = await run
    return reply(result.body, result.status)
  }
}

export function uninstallDemoInterceptor() {
  if (typeof window !== 'undefined' && originalFetch) {
    window.fetch = originalFetch
    originalFetch = null
  }
}

export { PRODUCTION_ONLY }
