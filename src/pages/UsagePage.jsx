import React from 'react'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { useRouter } from '../router'

const STEPS = [
  ['Create or join a team', 'Create a workspace, or paste an invite link from an admin to join theirs.'],
  ['Connect GitHub', 'Link your GitHub account, install the Baton GitHub App on the repositories you want, then connect each one. You can connect as many repositories as you like.'],
  ['Sync a repository', 'Syncing imports commits, pull requests and branches, and builds the contribution matrix and bus-factor alerts.'],
  ['Create an MCP token', 'Add Baton to Cursor, Claude Code or another MCP client so decisions and blockers are captured as you work.'],
  ['Start a handover', 'Pick the leaver and the incoming engineer, answer the risk-ranked questions, resolve conflicts and approve a cited packet.']
]

export function UsagePage() {
  const { navigate } = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '28px 24px 80px' }}>
      <header style={{ maxWidth: 880, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Brand size={22} />
        <nav aria-label="Primary" style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => navigate('/')}>Home</Button>
        </nav>
      </header>

      <main id="main" style={{ maxWidth: 880, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', letterSpacing: -1, fontWeight: 600, margin: '56px 0 10px' }}>
          Getting started with Baton
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, margin: '0 0 34px', maxWidth: 620 }}>
          Baton turns Git history and the decisions your team records into cited handover packets, so the next engineer
          does not start from zero.
        </p>

        <section aria-labelledby="mode-heading" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <h2 id="mode-heading" className="sr-only">Choose a workspace</h2>
          <div className="ws-card" style={{ margin: 0 }}>
            <div className="ws-card-title" style={{ marginBottom: 8 }}>Your workspace</div>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px' }}>
              Real data only: your team, your repositories and your handovers.
            </p>
            <Button primary onClick={() => navigate('/dashboard')}>Open dashboard</Button>
          </div>
          <div className="ws-card" style={{ margin: 0 }}>
            <div className="ws-card-title" style={{ marginBottom: 8 }}>Sample workspace</div>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 18px' }}>
              A read-only sandbox with illustrative sample data. Nothing here is saved to your account.
            </p>
            <Button onClick={() => navigate('/demo-page')}>Try the sample workspace</Button>
          </div>
        </section>

        <section aria-labelledby="steps-heading" style={{ marginTop: 48 }}>
          <h2 id="steps-heading" style={{ fontSize: 22, fontWeight: 600, margin: '0 0 18px' }}>Set up in five steps</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
            {STEPS.map(([title, text], index) => (
              <li key={title} className="ws-card" style={{ margin: 0, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <span className="ws-badge ws-badge-verified" aria-hidden="true">{index + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>{text}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}

export default UsagePage
