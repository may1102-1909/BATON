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
      if (activeId) setState(await get(orgPath(activeId, '/state')))
      else setState(null)
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
    try { setState(await get(orgPath(orgId, '/state'))) }
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
    try { setState(await get(orgPath(id, '/state'))) }
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
          {tab === 'Overview' && <Overview org={org} state={state} sources={sources} tasks={tasks} handovers={handovers} repositories={repositories} onNavigate={setTab}/>}
          {tab === 'Memory' && <Memory orgId={org.id} sources={sources} repositories={repositories} busy={busy} act={act}/>}
          {tab === 'GitHub' && <GitHub orgId={org.id} repositories={repositories} sources={sources} health={health} busy={busy} act={act}/>}
          {tab === 'Team' && <Team org={org} orgId={org.id} members={members} tokens={tokens} busy={busy} act={act} onOrgCreated={loadWorkspace}/>}
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

function Overview({ org, state, sources, tasks, handovers, repositories, onNavigate }) {
  const riskValues = arr(state?.risks)
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
