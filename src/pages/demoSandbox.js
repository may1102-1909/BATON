// Browser side of Baton Demo Mode (/demo-page). State lives in this browser only; every API call is
// answered by the real engine through POST /api/demo (server/demo.js), which keeps nothing and uses no credentials.
import snapshot from './demoSnapshot.json' with { type: 'json' }

const STORAGE_KEY = 'baton_demo_state_v6'
const LEGACY_STORAGE_KEYS = ['baton_demo_state_v5', 'baton_demo_state_v4', 'baton_demo_state_v3', 'baton_demo_state_v2', 'baton_demo_state']
const ORG_ID = 'demo-org'
const REPO_ID = 'demo-repo'
const DEMO_INSTALLATION_ID = 'demo-installation'
const ADMIN_LOGIN = 'may1102-1909'
const SEED_DATE = '2026-11-01T10:00:00Z'
const PRODUCTION_ONLY = 'Available in Production mode'

const LEAVER_LOGIN = 'vikrannntttt8'
const INCOMING_LOGIN = 'krishna2205gupta-rgb'
// GitHub attributes some of Vikrant's commits (git author "vikrannntttt8") to the linked account "renoschubert".
const LOGIN_ALIASES = { renoschubert: LEAVER_LOGIN }
const alias = login => LOGIN_ALIASES[login] ?? login
const toFiles = list => (list ?? []).map(filename => ({ filename }))

// Commits, pull requests and branches in the snapshot shape become engine "sources".
export function sourcesFromSnapshot(data, repoId = REPO_ID) {
  const repo = data.repository
  const common = { org_id: ORG_ID, repository_id: repoId, author_id: null, visibility: 'team' }
  const sources = []
  for (const raw of data.commits ?? []) {
    const commit = { ...raw, author_login: alias(raw.author_login) }
    sources.push({
      ...common, id: `gh-commit-${commit.sha.slice(0, 12)}`, external_id: `github:${repo}:commit:${commit.sha}`,
      author_login: commit.author_login, type: 'commit', content: String(commit.message ?? '').slice(0, 500), url: commit.url,
      metadata: { kind: 'commit', sha: commit.sha, author_login: commit.author_login, url: commit.url, repository: repo, audience: ['all'], ...(commit.files ? { files: toFiles(commit.files) } : {}) },
      created_at: commit.date
    })
  }
  for (const raw of data.pulls ?? []) {
    const pr = { ...raw, author_login: alias(raw.author_login) }
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

// The repository's collaborators: Vikrant (frontend) hands over to Krishna.
const people = { leaver: LEAVER_LOGIN, incoming: INCOMING_LOGIN }

export const DEMO_PERSONAS = [
  { id: 'demo-admin', name: 'May (Admin)', role: 'Team lead' },
  { id: 'demo-leaver', name: 'Vikrant GP', role: 'Leaving engineer (frontend)' },
  { id: 'demo-incoming', name: 'Krishna Gupta', role: 'Incoming engineer' }
]

export const DEMO_SIMULATOR_SAMPLE = {
  decision: '[SAMPLE] Rotate the deploy key after it appeared in a build log',
  reason: '[SAMPLE] The log contained ' + 'sk_' + 'live_SAMPLE00000000000000000000' + '. This is a made-up key to show redaction before anything is stored.'
}

// An Antigravity IDE session connected to baton-mcp-server. sync_history reads the conversation turns and
// save_memory stores what was decided; the demo replays those calls with the visitor's new MCP token.
export const ANTIGRAVITY_SESSION = {
  client: 'antigravity',
  session_id: 'agy-session-landing-hero',
  config_path: '.agents/mcp_config.json',
  turns: [
    { index: 1, role: 'user', content: 'The 3D paper hero makes the landing page janky on my laptop. Speed it up without losing the look.' },
    { index: 2, role: 'assistant', content: 'I will keep the shader in its own iframe (srcDoc) so it cannot block the React app, drop the extra hero overlays and lower the paper mesh detail in src/shaders/3d-paper/sources/3d-paper-baton.html.' },
    { index: 3, role: 'user', content: 'Also check the /usage page, it feels heavy on mobile.' },
    { index: 4, role: 'assistant', content: 'The two developer sticker images in public/stickers are about 780 KB each and load on every visit to /usage. They should be converted to WebP and lazy-loaded; I have not done that yet.' }
  ],
  memories: [
    {
      event_id: 'agy-1', type: 'decision',
      content: '[Antigravity · MCP] The landing-page shader renders inside its own iframe so it never blocks the React app.',
      metadata: { decision: 'Isolate the 3D Paper hero in an iframe', reason: 'The shader competed with the app for the main thread; an isolated frame keeps navigation responsive.', files_affected: ['src/shaders/3d-paper/ThreeDPaper.tsx', 'src/pages/LandingPage.jsx'], source_turns: [1, 2] }
    },
    {
      event_id: 'agy-2', type: 'decision',
      content: '[Antigravity · MCP] Hero overlays were removed and the paper mesh simplified for faster first paint.',
      metadata: { decision: 'Streamline the hero and lower shader detail', reason: 'Low-end laptops dropped frames; the simpler hero keeps the same look.', files_affected: ['src/shaders/3d-paper/sources/3d-paper-baton.html'], source_turns: [2] }
    },
    {
      event_id: 'agy-3', type: 'blocker',
      content: '[Antigravity · MCP] The /usage page loads two ~780 KB sticker PNGs on every visit; not yet converted or lazy-loaded.',
      metadata: { problem: 'Sticker images on /usage are ~780 KB PNGs each', status: 'active', workaround_notes: 'Convert public/stickers/*.png to WebP and add loading="lazy" in src/pages/UsagePage.jsx.', files_affected: ['public/stickers/dev-glasses.png', 'src/pages/UsagePage.jsx'], source_turns: [3, 4] }
    }
  ]
}

const isAntigravityMemory = source => source?.metadata?.mcp_client === ANTIGRAVITY_SESSION.client

// Uses the same collector endpoint as save_memory, authenticated with the token Antigravity was configured with.
async function syncAntigravitySession(token) {
  const { repositories = [] } = loadDemoState()
  for (const memory of ANTIGRAVITY_SESSION.memories) {
    await callEngine(currentPersona, 'POST', '/api/collector/push', {
      payload: {
        type: memory.type, content: memory.content, repository_id: repositories[0]?.id ?? null,
        session_id: ANTIGRAVITY_SESSION.session_id, event_id: memory.event_id,
        metadata: { ...memory.metadata, mcp_client: ANTIGRAVITY_SESSION.client, mcp_server: 'baton-mcp-server', mcp_tools: ['sync_history', 'save_memory'] }
      }
    }, `Bearer ${token}`)
  }
}

export function getInitialDemoState() {
  const member = (id, user_id, name, role, github_login) => ({ id, org_id: ORG_ID, user_id, name, role, ...(github_login ? { github_login } : {}), created_at: SEED_DATE })
  const members = [
    member('m-admin', 'demo-admin', 'May (Admin)', 'admin', ADMIN_LOGIN),
    member('m-leaver', 'demo-leaver', DEMO_PERSONAS[1].name, 'member', people.leaver),
    { ...member('m-incoming', 'demo-incoming', DEMO_PERSONAS[2].name, 'member', people.incoming), function_role: 'frontend' }
  ]
  const idFor = login => members.find(item => item.github_login === login)?.user_id ?? null
  const sources = sourcesFromSnapshot(snapshot)
  const now = snapshot.generated_at

  // Decisions: commits that record a choice (the leaving engineer's first), plus the project's own agent protocol.
  const choice = /^(feat|refactor)\b|\b(migrat|switch|replac|adopt)/i
  const choices = snapshot.commits.filter(item => choice.test(item.message)).map(item => ({ ...item, author_login: alias(item.author_login) }))
  for (const commit of [...choices.filter(item => item.author_login === people.leaver).slice(0, 6), ...choices.filter(item => item.author_login !== people.leaver).slice(0, 4)]) {
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

  // Records the leaving engineer added by hand (not in the git history). `illustrative` marks them for the demo's own bookkeeping.
  const byLeaver = { org_id: ORG_ID, repository_id: REPO_ID, author_id: idFor(people.leaver), author_login: people.leaver, visibility: 'team', created_at: now }
  sources.push(
    {
      ...byLeaver, id: 'note-route-split', type: 'decision',
      content: 'Keep the landing page (/) separate from the signed-in app (/dashboard, /usage) so the 3D hero never loads inside the workspace.',
      metadata: { decision: 'Landing page and app use separate routes', reason: 'The shader is heavy; signed-in users should not pay for it on every page.', files_affected: ['src/router.jsx', 'src/pages/LandingPage.jsx'], illustrative: true }
    },
    {
      ...byLeaver, id: 'note-redaction', type: 'decision',
      content: 'Setup notes for the /usage page mentioned an API key [REDACTED: API_KEY]; Baton scrubbed the raw value before it was stored.',
      metadata: { decision: 'Never paste real keys into the usage guide', reason: 'Shows that secrets never reach storage.', files_affected: ['src/pages/UsagePage.jsx'], illustrative: true }
    },
    {
      ...byLeaver, id: 'note-shader-bundle', type: 'blocker',
      content: 'ThreeDPaper.tsx imports all four 3D Paper template variants as raw HTML, so the unused certificate, japanese and site-of-the-year pages ship in the landing bundle.',
      metadata: { status: 'active', problem: 'Unused shader templates are bundled with the landing page', workaround_notes: 'Load the variants with dynamic import(), or delete the ones the landing page does not use.', files_affected: ['src/shaders/3d-paper/ThreeDPaper.tsx'], illustrative: true }
    },
    {
      ...byLeaver, id: 'note-vercel-access', type: 'blocker',
      content: 'Infra: production environment variables for the frontend build live in the team owner\'s Vercel account; only the owner can change them.',
      metadata: { status: 'active', problem: 'Frontend build settings need the Vercel owner', audience: ['infra'], files_affected: ['vite.config.js'], illustrative: true }
    }
  )

  return {
    organizations: [{ id: ORG_ID, name: 'Mumbai_wale Hackathon Org · DEMO', created_by: 'demo-admin', created_at: SEED_DATE }],
    members,
    repositories: [{ id: REPO_ID, org_id: ORG_ID, full_name: snapshot.repository, installation_id: DEMO_INSTALLATION_ID, last_synced_at: now, demo: true, created_at: SEED_DATE }],
    sources,
    tasks: [{
      id: 'handover-task', org_id: ORG_ID, title: 'Walk Krishna through the landing page shader and the /usage page', description: 'Cover the 3D Paper hero, routing and the usage guide before Vikrant leaves.',
      assignee_id: 'demo-leaver', created_by: 'demo-admin', status: 'open', due_at: '2026-11-10', created_at: SEED_DATE
    }],
    task_comments: [{
      id: 'handover-task-comment', org_id: ORG_ID, task_id: 'handover-task', author_id: 'demo-admin', parent_id: null, created_at: SEED_DATE,
      content: 'Walkthrough moved to 15 Nov because Krishna is reviewing the /usage page copy first.'
    }],
    handovers: []
  }
}

export function loadDemoState() {
  if (typeof window === 'undefined') return getInitialDemoState()
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key)
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

async function callEngine(persona, method, path, body, authorization) {
  const state = loadDemoState()
  let response
  try {
    response = await originalFetch.call(window, '/api/demo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, state, request: { method, path, body, ...(authorization ? { authorization } : {}) } })
    })
  } catch {
    return { status: 503, body: { error: 'The demo engine could not be reached' } }
  }
  if (!response.ok) return { status: 503, body: { error: 'The demo engine is unavailable right now' } }
  const result = await response.json()
  if (result.state) saveDemoState(result.state)
  return result
}

// The handover is built once an MCP token exists (the step that connects an agent to Baton): the real engine
// answers the interview from the repository data and approves the claims, leaving only the conflict for the visitor.
async function ensureSeedHandover() {
  const state = loadDemoState()
  if (state.handovers?.length) return
  if (!(state.tokens ?? []).some(token => !token.revoked_at)) return
  await callEngine('demo-admin', 'POST', '/api/demo/prepare-handover', { orgId: ORG_ID, leaverId: 'demo-leaver', incomingId: 'demo-incoming' })
}

// Revoking removes the token from the demo, and with no active token left the handover is withdrawn so the
// visitor is back at "create an MCP token first".
function revokeDemoToken(tokenId) {
  const state = loadDemoState()
  const before = (state.tokens ?? []).length
  state.tokens = (state.tokens ?? []).filter(token => token.id !== tokenId)
  if (state.tokens.length === before) return { status: 404, body: { error: 'Token not found' } }
  if (!state.tokens.some(token => !token.revoked_at)) {
    const ids = new Set((state.handovers ?? []).map(handover => handover.id))
    state.handovers = []
    for (const table of ['handover_claims', 'handover_questions', 'handover_events', 'handover_versions']) {
      if (Array.isArray(state[table])) state[table] = state[table].filter(row => !ids.has(row.handover_id))
    }
    state.sources = (state.sources ?? []).filter(source => !ids.has(source.metadata?.handover_id) && !isAntigravityMemory(source))
  }
  saveDemoState(state)
  return { status: 200, body: { record: { id: tokenId, revoked_at: new Date().toISOString() }, handover_withdrawn: !state.handovers.length } }
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

// Accepting happens in the browser: the demo has no second signed-in user, so the invite adds a new teammate.
async function acceptDemoInvite(token) {
  const state = loadDemoState()
  const tokenHash = await sha256Hex(String(token ?? ''))
  const invite = (state.invites ?? []).find(item => item.token_hash === tokenHash)
  if (!invite || invite.accepted_at || Date.parse(invite.expires_at) <= Date.now()) return { status: 400, body: { error: 'Invite is invalid, expired, or already used' } }
  const now = new Date().toISOString()
  const count = state.members.filter(item => item.user_id.startsWith('demo-invitee')).length + 1
  const membership = { id: `m-invitee-${count}`, org_id: invite.org_id, user_id: `demo-invitee-${count}`, name: `Invited teammate ${count}`, role: invite.role === 'admin' ? 'admin' : 'member', created_at: now }
  invite.accepted_at = now
  invite.accepted_by = membership.user_id
  state.members.push(membership)
  saveDemoState(state)
  return { status: 200, body: { organization_id: invite.org_id, membership } }
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
    const headers = new Headers(init.headers || {})
    const authorization = headers.get('authorization') || undefined
    // Requests are serialized so concurrent calls never overwrite each other's state.
    const run = queue.then(async () => {
      if (pathname === '/api/invites/accept' && method === 'POST') return acceptDemoInvite(body?.token)
      const revoke = method === 'DELETE' && /^\/api\/orgs\/[^/]+\/tokens\/([^/]+)$/.exec(pathname)
      if (revoke) return revokeDemoToken(decodeURIComponent(revoke[1]))
      if (/^\/api\/orgs\/[^/]+\/state$/.test(pathname)) await ensureSeedHandover()
      const result = await callEngine(persona, method, pathname + url.search, body, authorization)
      // A new token is what connects Antigravity, so its memory is stored before the handover is built.
      if (method === 'POST' && /^\/api\/orgs\/[^/]+\/tokens$/.test(pathname) && result.status < 300 && result.body?.token) {
        await syncAntigravitySession(result.body.token)
      }
      return result
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
