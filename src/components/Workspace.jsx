import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, del, get, orgPath, patch, post, setDemoContext } from '../lib/api'
import './workspace.css'

const TABS = ['Overview', 'Memory', 'GitHub', 'Team', 'Tasks', 'Handovers']
const DEMO_USERS = ['demo-admin', 'demo-leaver', 'demo-incoming']
const arr = value => Array.isArray(value) ? value : []
const nameOf = item => item?.name || item?.full_name || item?.email || item?.id || 'Unknown'
const idOf = item => item?.id || item?.user_id || ''
const asDate = value => value ? new Date(value).toLocaleDateString() : 'No due date'
const errorText = error => error?.message || 'Something went wrong. Please try again.'

function Empty({ title, detail, action }) {
  return <div className="ws-empty"><span className="ws-empty-mark" aria-hidden="true">—</span><h3>{title}</h3><p>{detail}</p>{action}</div>
}

function Field({ label, ...props }) {
  return <label className="ws-field"><span>{label}</span><input {...props}/></label>
}

function Select({ label, children, ...props }) {
  return <label className="ws-field"><span>{label}</span><select {...props}>{children}</select></label>
}

export default function Workspace() {
  const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('baton-demo-user') : null
  const [health, setHealth] = useState(null)
  const [demoUser, setDemoUser] = useState(DEMO_USERS.includes(savedUser) ? savedUser : 'demo-admin')
  const [me, setMe] = useState(null)
  const [orgId, setOrgId] = useState('')
  const [state, setState] = useState(null)
  const [risks, setRisks] = useState([])
  const [tab, setTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const organizations = arr(me?.organizations)
  const org = organizations.find(item => String(item.id) === String(orgId)) || organizations[0]
  const canAdmin = ['admin', 'owner'].includes(String(org?.role || '').toLowerCase())
  const members = arr(state?.members)
  const repositories = arr(state?.repositories)
  const sources = arr(state?.sources)
  const tasks = arr(state?.tasks)
  const handovers = arr(state?.handovers)
  const tokens = arr(state?.tokens)

  const loadWorkspace = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const status = await get('/api/health')
      setHealth(status)
      const isDemo = Boolean(status.demo)
      setDemoContext(isDemo, demoUser)
      const profile = await get('/api/me')
      setMe(profile)
      const orgs = arr(profile.organizations)
      const activeId = orgs.some(item => String(item.id) === String(orgId)) ? orgId : String(orgs[0]?.id || '')
      setOrgId(activeId)
      if (activeId) {
        const [workspace, riskResult] = await Promise.all([get(orgPath(activeId, '/state')), get(orgPath(activeId, '/risks'))])
        setState(workspace)
        setRisks(arr(riskResult.risks || riskResult.items || riskResult))
      } else { setState(null); setRisks([]) }
    } catch (err) { setError(errorText(err)); setState(null) }
    finally { setLoading(false) }
  }, [demoUser])

  useEffect(() => { loadWorkspace() }, [loadWorkspace])
  useEffect(() => {
    if (!health?.demo) return
    setDemoContext(true, demoUser)
    localStorage.setItem('baton-demo-user', demoUser)
    loadWorkspace()
    // The demo identity is the only auth context that changes in-place.
  }, [demoUser])

  const refreshOrg = useCallback(async () => {
    if (!orgId) return
    setError('')
    try {
      const [workspace, riskResult] = await Promise.all([get(orgPath(orgId, '/state')), get(orgPath(orgId, '/risks'))])
      setState(workspace)
      setRisks(arr(riskResult.risks || riskResult.items || riskResult))
    }
    catch (err) { setError(errorText(err)) }
  }, [orgId])

  const act = async (operation, success) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await operation()
      if (success) setNotice(success)
      await refreshOrg()
      return result
    } catch (err) { setError(errorText(err)); return null }
    finally { setBusy(false) }
  }

  const switchOrg = async id => {
    setOrgId(id); setError(''); setState(null)
    if (!id) return
    try {
      const [workspace, riskResult] = await Promise.all([get(orgPath(id, '/state')), get(orgPath(id, '/risks'))])
      setState(workspace)
      setRisks(arr(riskResult.risks || riskResult.items || riskResult))
    }
    catch (err) { setError(errorText(err)) }
  }

  if (loading && !me) return <main className="ws-page"><div className="ws-loading" role="status">Loading your workspace…</div></main>

  return <main className="ws-page">
    <header className="ws-topbar">
      <a className="ws-brand" href="/dashboard" aria-label="Baton workspace home"><span className="ws-brand-mark">b</span><span>baton</span></a>
      <div className="ws-top-actions">
        {health?.demo && <label className="ws-demo-picker"><span>Demo identity</span><select aria-label="Demo identity" value={demoUser} onChange={event => setDemoUser(event.target.value)}>{DEMO_USERS.map(user => <option key={user}>{user}</option>)}</select><i>Demo</i></label>}
        {organizations.length > 1 && <Select label="Workspace" value={org?.id || ''} onChange={event => switchOrg(event.target.value)}>{organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}
        <a className="ws-avatar" href="/auth" aria-label="Account">{(me?.user?.email || me?.user?.name || 'U').slice(0, 1).toUpperCase()}</a>
      </div>
    </header>

    <div className="ws-container">
      <div className="ws-page-heading">
        <div><div className="ws-kicker">YOUR WORKSPACE</div><h1>{org?.name || 'Set up your workspace'}</h1><p>Keep team knowledge, work, and handovers connected.</p></div>
        <div className="ws-heading-actions">
          {org && <span className="ws-role">{org.role || 'Member'}</span>}
          <button className="ws-button ws-button-quiet" type="button" onClick={loadWorkspace} disabled={busy}>↻ <span>Refresh</span></button>
        </div>
      </div>

      {error && <div className="ws-alert ws-alert-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="ws-alert ws-alert-success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

      {!organizations.length ? <SetupPanel busy={busy} act={act} refresh={loadWorkspace}/> : <>
        <nav className="ws-tabs" aria-label="Workspace sections" role="tablist">{TABS.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}{item === 'Tasks' && tasks.some(task => task.status !== 'done') && <span className="ws-tab-count">{tasks.filter(task => task.status !== 'done').length}</span>}</button>)}</nav>
        <section className="ws-tab-content" role="tabpanel" aria-label={tab}>
          {loading && <div className="ws-inline-loading" role="status">Refreshing workspace…</div>}
          {tab === 'Overview' && <Overview org={org} risks={risks} state={state} sources={sources} tasks={tasks} handovers={handovers} repositories={repositories} onNavigate={setTab}/>}
          {tab === 'Memory' && <Memory orgId={org.id} userId={me?.user?.id} sources={sources} repositories={repositories} busy={busy} act={act}/>}
          {tab === 'GitHub' && <GitHub orgId={org.id} repositories={repositories} sources={sources} health={health} busy={busy} act={act}/>}
          {tab === 'Team' && <Team org={org} orgId={org.id} canAdmin={canAdmin} members={members} tokens={tokens} busy={busy} act={act} onOrgCreated={loadWorkspace}/>}
          {tab === 'Tasks' && <Tasks orgId={org.id} members={members} tasks={tasks} busy={busy} act={act}/>}
          {tab === 'Handovers' && <Handovers org={org} orgId={org.id} members={members} handovers={handovers} sources={sources} busy={busy} act={act}/>}
        </section>
      </>}
      <footer className="ws-footer"><span>Baton</span><span>Team knowledge, carried forward.</span></footer>
    </div>
  </main>
}

function SetupPanel({ busy, act, refresh }) {
  const [orgName, setOrgName] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  return <div className="ws-setup-grid">
    <article className="ws-panel"><div className="ws-kicker">GET STARTED</div><h2>Create an organization</h2><p>Give your team a shared place for decisions, sources, and handovers.</p><form onSubmit={event => { event.preventDefault(); if (!orgName.trim()) return; act(async () => { const result = await post('/api/orgs', { name: orgName.trim() }); setOrgName(''); await refresh(); return result }, 'Organization created.') }}><Field label="Organization name" placeholder="e.g. Acme Engineering" value={orgName} onChange={event => setOrgName(event.target.value)} required/><button className="ws-button ws-button-primary" disabled={busy || !orgName.trim()}>Create organization <span aria-hidden="true">↗</span></button></form></article>
    <article className="ws-panel"><div className="ws-kicker">ALREADY INVITED?</div><h2>Join a team</h2><p>Paste the invitation token shared by your organization admin.</p><form onSubmit={event => { event.preventDefault(); act(async () => { await post('/api/invites/accept', { token: inviteToken.trim() }); setInviteToken('') }, 'You joined the organization.') }}><Field label="Invitation token" placeholder="Paste invite token" value={inviteToken} onChange={event => setInviteToken(event.target.value)} required/><button className="ws-button ws-button-secondary" disabled={busy || !inviteToken.trim()}>Accept invitation <span aria-hidden="true">↗</span></button></form></article>
  </div>
}

function Overview({ org, risks, state, sources, tasks, handovers, repositories, onNavigate }) {
  const riskValues = arr(risks)
  const activeTasks = tasks.filter(task => !['done', 'cancelled'].includes(task.status))
  const openHandovers = handovers.filter(item => !['approved', 'acknowledged', 'complete'].includes(item.status))
  const sourceKinds = useMemo(() => sources.reduce((counts, item) => { const kind = item.type || item.source_type || 'other'; counts[kind] = (counts[kind] || 0) + 1; return counts }, {}), [sources])
  return <>
    <div className="ws-metric-grid">
      <Metric label="Knowledge sources" value={sources.length} foot="Captured team context" icon="✳" onClick={() => onNavigate('Memory')}/>
      <Metric label="Connected repositories" value={repositories.length} foot="GitHub project context" icon="⌘" onClick={() => onNavigate('GitHub')}/>
      <Metric label="Open tasks" value={activeTasks.length} foot="Work to move forward" icon="↗" onClick={() => onNavigate('Tasks')}/>
      <Metric label="Active handovers" value={openHandovers.length} foot="Transitions in progress" icon="⇢" onClick={() => onNavigate('Handovers')}/>
    </div>
    <div className="ws-overview-grid">
      <article className="ws-panel"><PanelTitle kicker="KNOWLEDGE BASE" title="Contribution snapshot" action={<button className="ws-link-button" onClick={() => onNavigate('Memory')}>View memory <span>↗</span></button>}/>
        {sources.length ? <><div className="ws-source-total"><strong>{sources.length}</strong><span>captured sources</span></div><div className="ws-breakdown">{Object.entries(sourceKinds).map(([kind, count]) => <div className="ws-breakdown-row" key={kind}><span>{kind.replaceAll('_', ' ')}</span><span className="ws-breakdown-track"><i style={{ width: `${Math.max(8, count / sources.length * 100)}%` }}/></span><b>{count}</b></div>)}</div></> : <Empty title="No knowledge captured yet" detail="Decisions, notes, and source evidence will show up here." action={<button className="ws-button ws-button-small" onClick={() => onNavigate('Memory')}>Add your first memory</button>}/>}
      </article>
      <article className="ws-panel"><PanelTitle kicker="NEEDS ATTENTION" title="Workspace risks"/>
        {riskValues.length ? <div className="ws-list">{riskValues.slice(0, 5).map((risk, index) => <div className="ws-list-row" key={idOf(risk) || index}><span className="ws-risk-dot"/><div><strong>{risk.title || risk.label || risk.content || 'Risk identified'}</strong><p>{risk.description || risk.detail || risk.status || 'Review the linked evidence.'}</p></div></div>)}</div> : <Empty title="No risks reported" detail="Risk signals will appear when there is evidence to review."/>}
      </article>
    </div>
    <div className="ws-overview-grid ws-overview-bottom">
      <article className="ws-panel"><PanelTitle kicker="IN MOTION" title="Recent tasks" action={<button className="ws-link-button" onClick={() => onNavigate('Tasks')}>All tasks <span>↗</span></button>}/>
        {tasks.length ? <div className="ws-list">{tasks.slice(0, 4).map(task => <div className="ws-list-row" key={idOf(task)}><span className={`ws-status-dot status-${task.status || 'open'}`}/><div className="ws-row-main"><strong>{task.title}</strong><p>{task.assignee?.name || nameOf(membersById(state?.members, task.assignee_id))} · {asDate(task.due_at)}</p></div><Status value={task.status || 'open'}/></div>)}</div> : <Empty title="No tasks yet" detail="Create a task to make the next step clear." action={<button className="ws-button ws-button-small" onClick={() => onNavigate('Tasks')}>Create a task</button>}/>}
      </article>
      <article className="ws-panel"><PanelTitle kicker="PEOPLE & PROCESS" title="Team handovers" action={<button className="ws-link-button" onClick={() => onNavigate('Handovers')}>Open handovers <span>↗</span></button>}/>
        {handovers.length ? <div className="ws-list">{handovers.slice(0, 4).map((item, index) => <div className="ws-list-row" key={idOf(item) || index}><span className="ws-avatar ws-avatar-small">{String(item.leaver?.name || item.leaver_name || 'H').slice(0, 1)}</span><div className="ws-row-main"><strong>{item.title || `${item.leaver?.name || item.leaver_name || 'Team member'} handover`}</strong><p>{item.incoming?.name || item.incoming_name || 'Incoming teammate'}</p></div><Status value={item.status || 'draft'}/></div>)}</div> : <Empty title="No handovers in progress" detail="Capture a clean transition when someone moves on." action={<button className="ws-button ws-button-small" onClick={() => onNavigate('Handovers')}>Start a handover</button>}/>}
      </article>
    </div>
    {org && <p className="ws-subtle ws-overview-note">This view reflects available organization evidence. Missing data is not treated as a risk-free signal.</p>}
  </>
}

function membersById(members = [], id) { return arr(members).find(member => String(idOf(member)) === String(id)) || {} }

function Metric({ label, value, foot, icon, onClick }) {
  return <button className="ws-metric" type="button" onClick={onClick}><span className="ws-metric-icon" aria-hidden="true">{icon}</span><span className="ws-metric-label">{label}</span><strong>{value}</strong><small>{foot}</small></button>
}

function PanelTitle({ kicker, title, action }) { return <div className="ws-panel-title"><div><div className="ws-kicker">{kicker}</div><h2>{title}</h2></div>{action}</div> }
function Status({ value }) { return <span className={`ws-pill status-pill-${String(value).toLowerCase().replaceAll(' ', '-')}`}>{String(value).replaceAll('_', ' ')}</span> }

function Memory({ orgId, userId, sources, repositories, busy, act }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ type: 'decision', content: '', repository_id: '', visibility: 'team' })
  const kinds = [...new Set(sources.map(source => source.type || source.source_type).filter(Boolean))]
  const visible = sources.filter(source => (filter === 'all' || (source.type || source.source_type) === filter) && (!query || `${source.content || ''} ${source.title || ''} ${source.repository?.full_name || ''}`.toLowerCase().includes(query.toLowerCase())))
  const save = async event => {
    event.preventDefault()
    const body = { ...form, content: form.content.trim(), repository_id: form.repository_id || null, metadata: {} }
    if (!body.content) return
    const result = await act(() => editing ? patch(orgPath(orgId, `/memories/${encodeURIComponent(editing.id)}`), { type: body.type, content: body.content, visibility: body.visibility }) : post(orgPath(orgId, '/memories'), body), editing ? 'Memory updated.' : 'Memory added.')
    if (result !== null) { setEditing(null); setForm({ type: 'decision', content: '', repository_id: '', visibility: 'team' }) }
  }
  const beginEdit = source => { setEditing(source); setForm({ type: source.type || 'note', content: source.content || '', repository_id: source.repository_id || '', visibility: source.visibility || 'team' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return <div className="ws-section-grid ws-memory-grid">
    <aside className="ws-panel ws-form-panel"><PanelTitle kicker="CAPTURE CONTEXT" title={editing ? 'Edit memory' : 'Add a memory'}/><p className="ws-panel-copy">Keep the why behind the work. Link memories to the repository they support.</p>
      <form className="ws-form" onSubmit={save}>
        <Select label="Type" value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{['decision', 'note', 'blocker', 'risk', 'dependency', 'question'].map(type => <option key={type}>{type}</option>)}</Select>
        <label className="ws-field"><span>Context</span><textarea rows="5" value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="What happened? Include the reasoning and relevant details." required/></label>
        <Select label="Repository" value={form.repository_id} onChange={event => setForm({ ...form, repository_id: event.target.value })}><option value="">No repository link</option>{repositories.map(repo => <option value={repo.id} key={repo.id}>{repo.full_name || nameOf(repo)}</option>)}</Select>
        <Select label="Visibility" value={form.visibility} onChange={event => setForm({ ...form, visibility: event.target.value })}><option value="team">Team</option><option value="admin">Admins only</option><option value="private">Only me</option></Select>
        <div className="ws-form-actions"><button className="ws-button ws-button-primary" disabled={busy || !form.content.trim()}>{editing ? 'Save changes' : 'Add memory'} <span>↗</span></button>{editing && <button className="ws-button ws-button-quiet" type="button" onClick={() => { setEditing(null); setForm({ type: 'decision', content: '', repository_id: '', visibility: 'team' }) }}>Cancel</button>}</div>
      </form>
    </aside>
    <div className="ws-memory-list"><div className="ws-memory-tools"><div><div className="ws-kicker">SHARED KNOWLEDGE</div><h2>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</h2></div><label className="ws-search"><span className="sr-only">Search sources</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search memory…"/><span aria-hidden="true">⌕</span></label></div>
      <div className="ws-filter-list" aria-label="Filter memory sources"><button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All <span>{sources.length}</span></button>{kinds.map(kind => <button key={kind} className={filter === kind ? 'is-active' : ''} onClick={() => setFilter(kind)}>{kind.replaceAll('_', ' ')} <span>{sources.filter(source => (source.type || source.source_type) === kind).length}</span></button>)}</div>
      {visible.length ? <div className="ws-memory-cards">{visible.map((source, index) => <MemoryCard key={idOf(source) || index} source={source} userId={userId} orgId={orgId} onEdit={beginEdit} act={act}/>)}</div> : <Empty title={sources.length ? 'No matching sources' : 'No memory captured yet'} detail={sources.length ? 'Try a different search or filter.' : 'Add a decision, blocker, or note to make useful context available to your team.'}/>}
    </div>
  </div>
}

function MemoryCard({ source, userId, orgId, onEdit, act }) {
  const authorId = source.author_id || source.created_by || source.user_id
  const canEdit = Boolean(userId && authorId && String(userId) === String(authorId)) && !['external', 'github'].includes(source.origin || source.source_type)
  return <article className="ws-memory-card"><div className="ws-memory-card-head"><span className="ws-type-label">{String(source.type || source.source_type || 'source').replaceAll('_', ' ')}</span><span className="ws-subtle">{asDate(source.created_at || source.updated_at)}</span></div>
    <p className="ws-memory-content">{source.content || source.title || 'Source details unavailable.'}</p>
    <div className="ws-memory-meta">{(source.repository?.full_name || source.repository_name) && <span>⌘ {source.repository?.full_name || source.repository_name}</span>}{source.author?.name && <span>By {source.author.name}</span>}{source.visibility && <span>{source.visibility}</span>}{Array.isArray(source.citations) && source.citations.map((citation, index) => <a href={citation.url || '#'} target={citation.url ? '_blank' : undefined} rel="noreferrer" key={citation.id || citation.url || index}>Evidence {index + 1} ↗</a>)}</div>
    {canEdit && <div className="ws-card-actions"><button className="ws-link-button" onClick={() => onEdit(source)}>Edit</button><button className="ws-link-button ws-danger-link" onClick={() => { if (window.confirm('Delete this memory? This cannot be undone.')) act(() => del(orgPath(orgId, `/memories/${encodeURIComponent(source.id)}`)), 'Memory deleted.') }}>Delete</button></div>}
  </article>
}

function GitHub({ orgId, repositories, sources, health, busy, act }) {
  const [installations, setInstallations] = useState([])
  const [selectedInstall, setSelectedInstall] = useState('')
  const [repoName, setRepoName] = useState('')
  const [loadingInstalls, setLoadingInstalls] = useState(false)
  const [installError, setInstallError] = useState('')
  const loadInstallations = async () => {
    setLoadingInstalls(true); setInstallError('')
    try {
      const result = await get(orgPath(orgId, '/github/installations'))
      const found = arr(result.installations || result)
      setInstallations(found)
      if (!selectedInstall && found[0]) setSelectedInstall(String(found[0].id || found[0].installationId || ''))
    } catch (err) { setInstallError(errorText(err)) }
    finally { setLoadingInstalls(false) }
  }
  const connect = async () => {
    const result = await act(() => get(orgPath(orgId, '/github/connect')))
    if (result?.url) window.location.assign(result.url)
  }
  const activity = sources.filter(source => ['github', 'pull_request', 'issue', 'commit', 'repository'].includes(String(source.type || source.source_type).toLowerCase()))
  return <div className="ws-column-layout">
    <article className="ws-panel"><div className="ws-github-header"><div><div className="ws-kicker">SOURCE CONTROL</div><h2>GitHub connection</h2><p>Bring repository activity into the shared team context.</p></div><span className={`ws-connection-dot ${health?.configured?.github ? 'is-connected' : ''}`}/></div>
      <div className="ws-config-note"><span>✳</span><p>{health?.configured?.github ? 'GitHub App credentials are configured for this server.' : 'GitHub App connection is not configured on this server yet. Ask an administrator to finish setup before connecting an installation.'}</p></div>
      <div className="ws-form-actions"><button className="ws-button ws-button-primary" type="button" disabled={busy} onClick={connect}>Connect GitHub <span>↗</span></button><button className="ws-button ws-button-secondary" type="button" onClick={loadInstallations} disabled={loadingInstalls}>{loadingInstalls ? 'Loading…' : 'Load installations'}</button></div>
      {installError && <p className="ws-inline-error" role="alert">{installError}</p>}
      {installations.length > 0 && <div className="ws-connect-repo"><Select label="GitHub installation" value={selectedInstall} onChange={event => setSelectedInstall(event.target.value)}>{installations.map(item => <option key={item.id || item.installationId} value={item.id || item.installationId}>{item.account?.login || item.account || item.name || `Installation ${item.id}`}</option>)}</Select><Field label="Repository (owner/name)" placeholder="acme/service" value={repoName} onChange={event => setRepoName(event.target.value)}/><button className="ws-button ws-button-secondary" disabled={busy || !selectedInstall || !repoName.trim()} onClick={() => act(() => post(orgPath(orgId, '/repositories'), { installationId: selectedInstall, fullName: repoName.trim() }), 'Repository connected.')}>Add repository <span>↗</span></button></div>}
    </article>
    <article className="ws-panel"><PanelTitle kicker="CONNECTED REPOSITORIES" title={`${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'}`}/>
      {repositories.length ? <div className="ws-repository-list">{repositories.map(repo => <div className="ws-repository" key={idOf(repo)}><span className="ws-repo-icon">⌘</span><div className="ws-row-main"><strong>{repo.full_name || nameOf(repo)}</strong><p>{repo.default_branch ? `Default branch: ${repo.default_branch}` : repo.private ? 'Private repository' : 'Connected repository'}</p></div><button className="ws-button ws-button-small" disabled={busy} onClick={() => act(() => post(orgPath(orgId, `/repositories/${encodeURIComponent(repo.id)}/sync`)), 'Repository sync started.')}>Sync now <span>↻</span></button></div>)}</div> : <Empty title="No repositories connected" detail="Connect a GitHub installation, then add repositories to see project activity here."/>}
    </article>
    <article className="ws-panel"><PanelTitle kicker="RECENT ACTIVITY" title="Repository evidence"/>
      {activity.length ? <div className="ws-list">{activity.slice(0, 8).map((item, index) => <div className="ws-activity-item" key={idOf(item) || index}><span className="ws-activity-icon">↗</span><div><strong>{item.title || item.content?.split('\n')[0] || item.type || 'Repository update'}</strong><p>{item.repository?.full_name || item.repository_name || 'GitHub'} · {asDate(item.created_at)}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open source ↗</a>}</div></div>)}</div> : <Empty title="No repository activity yet" detail="Synced pull requests, issues, and project changes will appear when available."/>}
    </article>
  </div>
}

function Team({ org, orgId, canAdmin, members, tokens, busy, act }) {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [invite, setInvite] = useState('')
  const [newTokenName, setNewTokenName] = useState('')
  const [createdToken, setCreatedToken] = useState('')
  const [joinToken, setJoinToken] = useState('')
  const [copied, setCopied] = useState(false)
  const createInvite = async event => {
    event.preventDefault()
    const result = await act(() => post(orgPath(orgId, '/invites'), { role: inviteRole, ...(email.trim() ? { email: email.trim() } : {}) }), 'Invitation created. Share the token securely.')
    if (result?.token) { setInvite(result.token); setEmail('') }
  }
  const createToken = async event => {
    event.preventDefault()
    const result = await act(() => post(orgPath(orgId, '/tokens'), { name: newTokenName.trim() }), 'API token created. It will only be shown once.')
    if (result?.token) { setCreatedToken(result.token); setNewTokenName('') }
  }
  const copy = async text => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setCopied(false) } }
  return <div className="ws-column-layout ws-team-layout">
    <article className="ws-panel"><PanelTitle kicker="YOUR ORGANIZATION" title="Team members" action={<span className="ws-member-count">{members.length} people</span>}/>
      {members.length ? <div className="ws-member-list">{members.map((member, index) => <div className="ws-member-row" key={idOf(member) || index}><span className="ws-avatar">{nameOf(member).slice(0, 1).toUpperCase()}</span><div className="ws-row-main"><strong>{nameOf(member)}</strong><p>{member.email || member.github_login || member.status || 'Organization member'}</p></div><Status value={member.role || 'member'}/></div>)}</div> : <Empty title="No team members found" detail="Organization membership details will appear here."/>}
      <p className="ws-subtle ws-team-note">Member roles and offboarding controls follow the organization access policy.</p>
    </article>
    {canAdmin ? <div className="ws-team-tools">
      <article className="ws-panel"><PanelTitle kicker="INVITE A TEAMMATE" title="Create invitation"/><p className="ws-panel-copy">An email is optional. Invitations expire after seven days.</p>
        <form className="ws-form" onSubmit={createInvite}><Field label="Email (optional)" type="email" placeholder="teammate@company.com" value={email} onChange={event => setEmail(event.target.value)}/><Select label="Role" value={inviteRole} onChange={event => setInviteRole(event.target.value)}><option value="member">Member</option><option value="team">Team</option></Select><button className="ws-button ws-button-primary" disabled={busy}>Create invitation <span>↗</span></button></form>
        {invite && <div className="ws-secret-box"><strong>Invitation token</strong><p>Send this token only to the intended teammate.</p><code>{invite}</code><button className="ws-button ws-button-small" onClick={() => copy(invite)}>{copied ? 'Copied' : 'Copy token'}</button></div>}
      </article>
      <article className="ws-panel"><PanelTitle kicker="JOIN AN ORGANIZATION" title="Accept invitation"/><form className="ws-form" onSubmit={event => { event.preventDefault(); act(async () => { await post('/api/invites/accept', { token: joinToken.trim() }); setJoinToken('') }, 'Invitation accepted.') }}><Field label="Invitation token" placeholder="Paste token" value={joinToken} onChange={event => setJoinToken(event.target.value)} required/><button className="ws-button ws-button-secondary" disabled={busy || !joinToken.trim()}>Join organization <span>↗</span></button></form>
      </article>
    </div>
    <article className="ws-panel"><PanelTitle kicker="MCP ACCESS" title="Agent connection tokens"/><p className="ws-panel-copy">Create a scoped token for Baton’s MCP tools. Treat it like a password: it grants access to this organization’s agent integration.</p>
      <form className="ws-inline-form" onSubmit={createToken}><Field label="Token name" placeholder="e.g. Cursor on laptop" value={newTokenName} onChange={event => setNewTokenName(event.target.value)} required/><button className="ws-button ws-button-primary" disabled={busy || !newTokenName.trim()}>Create token <span>↗</span></button></form>
      {createdToken && <div className="ws-token-created"><div><strong>Copy this token now</strong><p>It cannot be shown again. Do not commit it, paste it into shared chat, or expose it in a screenshot.</p></div><code>{createdToken}</code><button className="ws-button ws-button-small" onClick={() => copy(createdToken)}>{copied ? 'Copied' : 'Copy token'}</button><TokenSnippets token={createdToken} orgId={orgId} repositories={arr(org.repositories)}/></div>}
      {tokens.length ? <div className="ws-token-list">{tokens.map((token, index) => <div className="ws-token-row" key={idOf(token) || index}><span className="ws-token-icon">⌘</span><div className="ws-row-main"><strong>{token.name || 'Baton MCP token'}</strong><p>Created {asDate(token.created_at)}{token.expires_at ? ` · expires ${asDate(token.expires_at)}` : ''}</p></div><button className="ws-link-button ws-danger-link" disabled={busy} onClick={() => { if (window.confirm(`Revoke ${token.name || 'this token'}? Connected agents will stop working.`)) act(() => del(orgPath(orgId, `/tokens/${encodeURIComponent(token.id)}`)), 'Token revoked.') }}>Revoke</button></div>)}</div> : <p className="ws-empty-inline">No active tokens. Create one to connect an MCP client.</p>}
    </article></div> : <article className="ws-panel"><PanelTitle kicker="TEAM ACCESS" title="Organization permissions"/><p className="ws-panel-copy">Invite management and MCP token controls are available to organization admins. Ask an admin if you need an invitation or an agent connection key.</p><div className="ws-member-list">{members.filter(member => String(idOf(member)) === String(org.user_id)).map(member => <div className="ws-member-row" key={idOf(member)}><span className="ws-avatar">{nameOf(member).slice(0, 1).toUpperCase()}</span><div className="ws-row-main"><strong>{nameOf(member)}</strong><p>Your organization access</p></div><Status value={member.role || org.role}/></div>)}</div></article>}
  </div>
}

function TokenSnippets({ token, orgId, repositories }) {
  const repositoryId = repositories[0]?.id || '<repository-id>'
  const envFile = `BATON_API_URL=${window.location.origin}\nBATON_API_KEY=${token}\nBATON_ORG_ID=${orgId}\nBATON_REPOSITORY_ID=${repositoryId}\nBATON_REPO_PATH=/absolute/path/to/repository`
  const executable = '/absolute/path/to/repository/mcp-server/dist/index.js'
  const mcp = { command: 'node', args: [executable], env: { BATON_REPO_PATH: '/absolute/path/to/repository' } }
  const examples = [
    { name: 'Claude Desktop', text: JSON.stringify({ mcpServers: { baton: mcp } }, null, 2) },
    { name: 'Cursor', text: JSON.stringify({ mcpServers: { baton: mcp } }, null, 2) },
    { name: 'Codex', text: `[mcp_servers.baton]\ncommand = "node"\nargs = ["${executable}"]\n\n[mcp_servers.baton.env]\nBATON_REPO_PATH = "/absolute/path/to/repository"` },
    { name: 'Antigravity', text: JSON.stringify({ mcpServers: { baton: { command: 'node', args: ['./mcp-server/dist/index.js'], env: { BATON_REPO_PATH: '.' } } } }, null, 2) },
  ]
  return <details className="ws-snippets"><summary>Setup snippets and startup instructions</summary><p>Keep the credentials in <code>mcp-server/.env</code>, never in a client config. Replace the repository path and, if needed, the repository ID. Build the MCP server with <code>npm --prefix mcp-server ci &amp;&amp; npm --prefix mcp-server run build</code>. Restart your client after setup. Tool calls are controlled by the host application and are not automatic.</p><div className="ws-snippet"><strong>mcp-server/.env (secret — do not commit)</strong><pre>{envFile}</pre></div>{examples.map(example => <div className="ws-snippet" key={example.name}><strong>{example.name}</strong><pre>{example.text}</pre></div>)}</details>
}

function Tasks({ orgId, members, tasks, busy, act }) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [comments, setComments] = useState({})
  const [commentInput, setCommentInput] = useState({})
  const [filter, setFilter] = useState('active')
  const filtered = tasks.filter(task => filter === 'all' || (filter === 'active' ? !['done', 'cancelled'].includes(task.status) : task.status === filter))
  const createTask = async event => {
    event.preventDefault()
    const result = await act(() => post(orgPath(orgId, '/tasks'), { title: title.trim(), description: description.trim(), assignee_id: assignee || null, due_at: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null }), 'Task created.')
    if (result !== null) { setTitle(''); setDescription(''); setAssignee(''); setDueAt(''); setShowForm(false) }
  }
  const addComment = async (task, event) => {
    event.preventDefault()
    const content = (commentInput[task.id] || '').trim()
    if (!content) return
    const result = await act(() => post(`/api/tasks/${encodeURIComponent(task.id)}/comments`, { content }), 'Comment added.')
    if (result !== null) setCommentInput({ ...commentInput, [task.id]: '' })
  }
  return <div className="ws-column-layout">
    <div className="ws-section-heading"><div><div className="ws-kicker">WORK TRACKER</div><h2>Tasks for {tasks.length} commitments</h2><p>Make ownership and next steps visible to the whole team.</p></div><button className="ws-button ws-button-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : '+ New task'}</button></div>
    {showForm && <article className="ws-panel"><PanelTitle kicker="ADD A COMMITMENT" title="New task"/><form className="ws-task-form" onSubmit={createTask}><Field label="Task title" value={title} onChange={event => setTitle(event.target.value)} placeholder="What needs to happen next?" required/><label className="ws-field ws-field-wide"><span>Description</span><textarea rows="3" value={description} onChange={event => setDescription(event.target.value)} placeholder="Add useful context for the assignee."/></label><Select label="Assignee" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">Unassigned</option>{members.map((member, index) => <option key={idOf(member) || index} value={idOf(member)}>{nameOf(member)}</option>)}</Select><Field label="Due date" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)}/><button className="ws-button ws-button-primary" disabled={busy || !title.trim()}>Create task <span>↗</span></button></form></article>}
    <div className="ws-task-toolbar"><span className="ws-subtle">{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}</span><div className="ws-filter-list"><button className={filter === 'active' ? 'is-active' : ''} onClick={() => setFilter('active')}>Active</button><button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All</button>{['open', 'in_progress', 'done'].map(status => <button key={status} className={filter === status ? 'is-active' : ''} onClick={() => setFilter(status)}>{status.replace('_', ' ')}</button>)}</div></div>
    {filtered.length ? <div className="ws-task-list">{filtered.map(task => <article className="ws-panel ws-task-card" key={idOf(task)}>
      <div className="ws-task-card-top"><span className={`ws-status-dot status-${task.status || 'open'}`}/><div className="ws-row-main"><h3>{task.title}</h3><p>{task.description || 'No description provided.'}</p></div><Select label="Status" value={task.status || 'open'} onChange={event => act(() => patch(`/api/tasks/${encodeURIComponent(task.id)}`, { status: event.target.value }), 'Task updated.')}><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option></Select></div>
      <div className="ws-task-meta"><span>Assigned to <b>{task.assignee?.name || task.assignee?.email || nameOf(membersById(members, task.assignee_id))}</b></span><span>Due {asDate(task.due_at)}</span><span>{arr(task.comments).length} comments</span></div>
      {arr(task.comments).length > 0 && <div className="ws-comments">{task.comments.map((comment, index) => <p key={idOf(comment) || index}><b>{comment.author?.name || comment.author_name || 'Teammate'}</b><span>{comment.content}</span><time>{asDate(comment.created_at)}</time></p>)}</div>}
      {comments[task.id] && <div className="ws-comments">{arr(comments[task.id]).map((comment, index) => <p key={idOf(comment) || index}><b>{comment.author?.name || 'Teammate'}</b><span>{comment.content}</span><time>{asDate(comment.created_at)}</time></p>)}</div>}
      <form className="ws-comment-form" onSubmit={event => addComment(task, event)}><label className="sr-only" htmlFor={`comment-${task.id}`}>Add a comment to {task.title}</label><input id={`comment-${task.id}`} value={commentInput[task.id] || ''} onChange={event => setCommentInput({ ...commentInput, [task.id]: event.target.value })} placeholder="Add a comment to this task…"/><button className="ws-button ws-button-small" disabled={busy || !(commentInput[task.id] || '').trim()}>Comment</button></form>
    </article>)}</div> : <Empty title={tasks.length ? 'No tasks match this filter' : 'No tasks yet'} detail={tasks.length ? 'Try viewing all tasks or another status.' : 'Create the first task to give the next step a clear owner.'} action={!tasks.length && <button className="ws-button ws-button-small" onClick={() => setShowForm(true)}>Create a task</button>}/>}
  </div>
}

function Handovers({ org, orgId, members, handovers, sources, busy, act }) {
  const [selection, setSelection] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [leaverId, setLeaverId] = useState('')
  const [incomingId, setIncomingId] = useState('')
  const [showStart, setShowStart] = useState(false)
  const [ask, setAsk] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [editingClaim, setEditingClaim] = useState('')
  const [claimText, setClaimText] = useState('')
  const [qaResult, setQaResult] = useState(null)

  useEffect(() => {
    if (!selection) { setDetail(null); return }
    let active = true
    setLoadingDetail(true); setDetailError('')
    get(`/api/handovers/${encodeURIComponent(selection)}`).then(result => { if (active) setDetail(result.handover || result) }).catch(error => { if (active) setDetailError(errorText(error)) }).finally(() => { if (active) setLoadingDetail(false) })
    return () => { active = false }
  }, [selection])

  const current = detail?.handover || detail
  const questions = arr(detail?.questions || current?.questions)
  const claims = arr(detail?.claims || current?.claims)
  const versions = arr(detail?.versions || current?.versions || current?.history)
  const evidence = arr(detail?.sources || detail?.evidence || current?.sources)
  const start = async event => {
    event.preventDefault()
    const result = await act(() => post(orgPath(orgId, '/handovers'), { leaverId, incomingId }), 'Handover started.')
    const handover = result?.handover || result
    if (handover?.id) { setSelection(String(handover.id)); setShowStart(false); setLeaverId(''); setIncomingId('') }
  }
  const runAction = async action => {
    const result = await act(() => post(`/api/handovers/${encodeURIComponent(selection)}/${action}`), action === 'generate' ? 'Handover generated from available evidence.' : action === 'approve' ? 'Handover approved.' : 'Handover acknowledged.')
    if (result) setDetail(result.handover || result)
  }
  const answerQuestion = async event => {
    event.preventDefault()
    const result = await act(() => post(`/api/handovers/${encodeURIComponent(selection)}/answers`, { questionId: question, answer: answer.trim() }), 'Answer recorded.')
    if (result) setDetail(result.handover || result)
    setAnswer(''); setQuestion('')
  }
  const askQuestion = async event => {
    event.preventDefault()
    const result = await act(() => post(`/api/handovers/${encodeURIComponent(selection)}/ask`, { question: ask.trim() }), 'Question answered from handover evidence.')
    if (result) setQaResult(result)
    setAsk('')
  }
  const reviewClaim = async (claim, status) => {
    const body = { status, ...(editingClaim === idOf(claim) ? { text: claimText.trim() } : {}) }
    const result = await act(() => patch(`/api/handovers/${encodeURIComponent(selection)}/claims/${encodeURIComponent(claim.id)}`, body), `Claim ${status}.`)
    if (result) setDetail(result.handover || result)
    setEditingClaim(''); setClaimText('')
  }

  return <div className="ws-handover-layout">
    <aside className="ws-panel ws-handover-sidebar"><div className="ws-handover-list-head"><div><div className="ws-kicker">KNOWLEDGE TRANSITIONS</div><h2>Handovers</h2></div>{['admin', 'owner'].includes(String(org.role || '').toLowerCase()) && <button className="ws-icon-button" aria-label="Start a handover" onClick={() => setShowStart(!showStart)}>+</button>}</div>
      {showStart && <form className="ws-start-handover" onSubmit={start}><Select label="Leaving teammate" value={leaverId} onChange={event => setLeaverId(event.target.value)} required><option value="">Choose a member</option>{members.map((member, index) => <option key={idOf(member) || index} value={idOf(member)}>{nameOf(member)}</option>)}</Select><Select label="Incoming teammate" value={incomingId} onChange={event => setIncomingId(event.target.value)} required><option value="">Choose a member</option>{members.filter(member => idOf(member) !== leaverId).map((member, index) => <option key={idOf(member) || index} value={idOf(member)}>{nameOf(member)}</option>)}</Select><button className="ws-button ws-button-primary" disabled={busy || !leaverId || !incomingId}>Start handover</button></form>}
      {handovers.length ? <div className="ws-handover-list">{handovers.map((item, index) => <button key={idOf(item) || index} className={`ws-handover-list-item ${selection === String(idOf(item)) ? 'is-selected' : ''}`} onClick={() => setSelection(String(idOf(item)))}><span className="ws-handover-person">{String(item.leaver?.name || item.leaver_name || 'H').slice(0, 1)}</span><span className="ws-handover-item-copy"><strong>{item.title || `${item.leaver?.name || item.leaver_name || 'Team member'}`}</strong><small>to {item.incoming?.name || item.incoming_name || 'incoming teammate'}</small></span><Status value={item.status || 'draft'}/></button>)}</div> : <Empty title="No handovers" detail="A workspace admin can start a transition for a team member."/>}
    </aside>
    <div className="ws-handover-main">
      {detailError && <div className="ws-alert ws-alert-error" role="alert">{detailError}</div>}
      {loadingDetail ? <div className="ws-panel ws-loading" role="status">Loading handover evidence…</div> : current ? <>
        <article className="ws-panel ws-handover-hero"><div className="ws-handover-hero-title"><div><div className="ws-kicker">TEAM TRANSITION</div><h2>{current.title || `${current.leaver?.name || current.leaver_name || 'Team member'} handover`}</h2><p>{current.leaver?.name || current.leaver_name || 'Departing teammate'} <span>→</span> {current.incoming?.name || current.incoming_name || 'Incoming teammate'}</p></div><Status value={current.status || 'draft'}/></div>
          <div className="ws-handover-actions"><button className="ws-button ws-button-secondary" disabled={busy} onClick={() => runAction('generate')}>Generate from evidence <span>✳</span></button>{['admin', 'owner'].includes(String(org.role || '').toLowerCase()) && <button className="ws-button ws-button-primary" disabled={busy || !claims.length} onClick={() => runAction('approve')}>Approve handover <span>↗</span></button>}{current.status === 'approved' && <button className="ws-button ws-button-primary" disabled={busy} onClick={() => runAction('acknowledge')}>Acknowledge handover <span>✓</span></button>}</div>
        </article>
        <article className="ws-panel"><PanelTitle kicker="LEAVER INTERVIEW" title="Questions & answers"/>
          {questions.length ? <div className="ws-question-list">{questions.map((item, index) => <div className="ws-question" key={idOf(item) || index}><div className="ws-question-number">{String(index + 1).padStart(2, '0')}</div><div><strong>{item.question || item.text || item.title}</strong>{item.answer ? <p className="ws-answer-text">{item.answer}</p> : <p className="ws-subtle">Waiting for an answer</p>}{item.answer && item.created_at && <small>{asDate(item.created_at)}</small>}</div></div>)}</div> : <Empty title="No interview questions yet" detail="Generate questions from this teammate’s knowledge sources."/>}
          <form className="ws-answer-form" onSubmit={answerQuestion}><Select label="Question to answer" value={question} onChange={event => setQuestion(event.target.value)}><option value="">Choose an open question</option>{questions.filter(item => !item.answer).map((item, index) => <option key={idOf(item) || index} value={idOf(item)}>{item.question || item.text || `Question ${index + 1}`}</option>)}</Select><label className="ws-field"><span>Answer</span><textarea rows="3" value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Add the teammate's answer with useful specifics…"/></label><button className="ws-button ws-button-secondary" disabled={busy || !question || !answer.trim()}>Save answer <span>↗</span></button></form>
        </article>
        <article className="ws-panel"><PanelTitle kicker="EVIDENCE-LED SUMMARY" title="Claims review"/>
          <p className="ws-panel-copy">Review each claim against its cited evidence. Missing evidence is called out rather than filled with guesses.</p>
          {claims.length ? <div className="ws-claims">{claims.map((claim, index) => <div className="ws-claim" key={idOf(claim) || index}><div className="ws-claim-head"><span className="ws-type-label">{claim.label || claim.category || claim.type || 'Claim'}</span><Status value={claim.status || claim.confidence || 'pending'}/></div>
            {editingClaim === idOf(claim) ? <textarea className="ws-claim-edit" value={claimText} onChange={event => setClaimText(event.target.value)} aria-label="Edit claim text"/> : <p>{claim.text || claim.content || 'Claim text unavailable.'}</p>}
            <div className="ws-claim-sources">{arr(claim.source_ids || claim.sources).length ? arr(claim.source_ids || claim.sources).map((sourceId, sourceIndex) => { const source = sources.find(item => String(idOf(item)) === String(typeof sourceId === 'object' ? idOf(sourceId) : sourceId)); return <a href={source?.url || '#'} onClick={event => { if (!source?.url) event.preventDefault() }} key={typeof sourceId === 'object' ? idOf(sourceId) || sourceIndex : sourceId}>Source: {source?.title || source?.content?.slice(0, 65) || `evidence ${sourceIndex + 1}`} ↗</a> }) : <span>No source citations</span>}</div>
            <div className="ws-claim-actions">{editingClaim === idOf(claim) ? <><button className="ws-button ws-button-small" disabled={busy || !claimText.trim()} onClick={() => reviewClaim(claim, claim.status || 'pending')}>Save edit</button><button className="ws-link-button" onClick={() => setEditingClaim('')}>Cancel</button></> : <><button className="ws-link-button" onClick={() => { setEditingClaim(idOf(claim)); setClaimText(claim.text || claim.content || '') }}>Edit</button><button className="ws-link-button ws-success-link" disabled={busy} onClick={() => reviewClaim(claim, 'approved')}>Approve</button><button className="ws-link-button ws-danger-link" disabled={busy} onClick={() => reviewClaim(claim, 'rejected')}>Reject</button><button className="ws-link-button" disabled={busy} onClick={() => reviewClaim(claim, 'pending')}>Needs review</button></>}</div>
          </div>)}</div> : <Empty title="No generated claims" detail="Generate an evidence-based summary before approving this handover."/>}
        </article>
        <article className="ws-panel"><PanelTitle kicker="ASK THE HANDOVER" title="Cited Q&A"/><p className="ws-panel-copy">Ask a question about this transition. Answers are grounded in available handover evidence.</p><form className="ws-inline-form" onSubmit={askQuestion}><Field label="Question" placeholder="What should the incoming person know about…?" value={ask} onChange={event => setAsk(event.target.value)} required/><button className="ws-button ws-button-secondary" disabled={busy || !ask.trim()}>Ask <span>↗</span></button></form>
          {qaResult && <div className="ws-qa-answer"><strong>Answer</strong><p>{qaResult.answer || qaResult.response || 'No answer was returned.'}</p>{arr(qaResult.sources || qaResult.citations).map((source, index) => <a href={source.url || '#'} key={idOf(source) || index}>{source.title || source.content || `Source ${index + 1}`} ↗</a>)}</div>}
        </article>
        {versions.length > 0 && <article className="ws-panel"><PanelTitle kicker="AUDIT TRAIL" title="Version history"/><ol className="ws-version-list">{versions.map((version, index) => <li key={idOf(version) || version.version || index}><span className="ws-version-dot"/><div><strong>{version.label || version.action || version.status || `Version ${version.version || index + 1}`}</strong><p>{version.actor?.name || version.actor_name || 'Team member'} · {asDate(version.created_at)}</p></div></li>)}</ol></article>}
      </> : <article className="ws-panel ws-empty-detail"><Empty title={handovers.length ? 'Select a handover' : 'Start a team handover'} detail={handovers.length ? 'Choose a teammate transition to review its questions, evidence, and claims.' : 'This organization has no handovers yet. An admin can create a knowledge transition from the panel.'}/></article>}
    </div>
  </div>
}
