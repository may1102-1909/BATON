import React, { useState, useEffect } from 'react'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { Button } from './Button'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

const mockDecisions = [
  {
    id: 'dec-1',
    decision: 'Migrated auth from Firebase to Supabase',
    reason: 'Firebase tier limits blocked enterprise team growth and schema flexibility.',
    alternatives: ['Auth0', 'NextAuth / Auth.js'],
    files_affected: ['src/lib/supabase.js', 'src/components/Auth.jsx'],
    status: 'Verified',
    citation: 'PR #42',
    timestamp: '2 hours ago'
  },
  {
    id: 'dec-2',
    decision: 'Adopted Baton Local MCP Server over StdioServerTransport',
    reason: 'Zero-latency local indexing of architectural reasoning with client-side secret redaction.',
    alternatives: ['Manual Notion wiki', 'Centralized cloud webhook'],
    files_affected: ['mcp-server/src/index.ts', '.antigravity/mcp.json'],
    status: 'Verified',
    citation: 'Commit bada27f',
    timestamp: '4 hours ago'
  },
  {
    id: 'dec-3',
    decision: 'Switched bundle target to Vite 6 ESM build',
    reason: 'Sub-second HMR and native ESM compilation for frontend preview.',
    alternatives: ['Webpack 5', 'Turbopack'],
    files_affected: ['vite.config.js', 'package.json'],
    status: 'Verified',
    citation: 'Commit ce7da48',
    timestamp: 'Yesterday'
  }
]

const mockBlockers = [
  {
    id: 'blk-1',
    problem: 'Payment webhook retry handler pending verification on staging environment',
    status: 'investigating',
    workaround_notes: 'Staging webhook endpoint simulated with HMAC signature mocking until test gateway is provisioned.',
    citation: 'Branch feat/pay'
  },
  {
    id: 'blk-2',
    problem: 'PowerShell script execution policy blocks npm.ps1 on Windows host',
    status: 'workaround_applied',
    workaround_notes: 'Commands must invoke npm.cmd and npx.cmd directly rather than PowerShell shim.',
    citation: 'Env policy'
  }
]

export function Dashboard({ user, onBack, onSignOut }) {
  const [activeTab, setActiveTab] = useState('decisions')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedHandoff, setCopiedHandoff] = useState(false)
  const [newDecision, setNewDecision] = useState({ decision: '', reason: '', files: '' })
  const [decisions, setDecisions] = useState(mockDecisions)
  const [blockers, setBlockers] = useState(mockBlockers)

  const filteredDecisions = decisions.filter(
    (d) =>
      d.decision.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.reason.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredBlockers = blockers.filter(
    (b) =>
      b.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.workaround_notes.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function handleCreateDecision(e) {
    e.preventDefault()
    if (!newDecision.decision || !newDecision.reason) return
    const created = {
      id: `dec-${Date.now()}`,
      decision: newDecision.decision,
      reason: newDecision.reason,
      alternatives: ['Evaluated during session'],
      files_affected: newDecision.files ? newDecision.files.split(',').map((f) => f.trim()) : [],
      status: 'Verified',
      citation: 'Agent Session',
      timestamp: 'Just now'
    }
    setDecisions([created, ...decisions])
    setNewDecision({ decision: '', reason: '', files: '' })
  }

  function copyHandoverMarkdown() {
    const md = `# BATON HANDOVER REPORT
Generated for: ${user?.email || 'Engineer'}
Timestamp: ${new Date().toISOString()}
Security: 3 secrets redacted · Project-scoped

## Architectural Decisions (${decisions.length})
${decisions.map((d, i) => `### ${i + 1}. ${d.decision}
- **Reason:** ${d.reason}
- **Citation:** [${d.citation}]
- **Files Affected:** ${d.files_affected.join(', ') || 'N/A'}
`).join('\n')}

## Active Blockers (${blockers.length})
${blockers.map((b, i) => `### ${i + 1}. ${b.problem}
- **Status:** ${b.status}
- **Workaround:** ${b.workaround_notes}
- **Citation:** ${b.citation}
`).join('\n')}
`
    navigator.clipboard.writeText(md).then(() => {
      setCopiedHandoff(true)
      setTimeout(() => setCopiedHandoff(false), 2500)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Top Bar */}
      <header
        style={{
          borderBottom: `1px solid ${C.line}`,
          background: '#0e1012',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}
      >
        <div
          className="bt-shell"
          style={{
            height: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Brand size={22} />
            <span
              style={{
                fontSize: 10,
                color: C.green,
                background: '#10b98115',
                border: '1px solid #284435',
                borderRadius: 4,
                padding: '4px 8px',
                fontFamily: 'monospace'
              }}
            >
              WORKSPACE
            </span>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#9ba0a9', fontFamily: 'monospace' }}>
              {user?.email || 'authenticated'}
            </span>
            <Button onClick={onBack} style={{ padding: '7px 14px', fontSize: 11 }}>
              <Icon name="back" size={13} />
              Landing Page
            </Button>
            <button
              onClick={onSignOut}
              className="bt-text"
              style={{
                background: 'none',
                border: 0,
                color: '#ef8585',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="bt-shell" style={{ padding: '36px 0 80px' }}>
        {/* Workspace Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 32
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.8, margin: '0 0 8px' }}>
              Handover Continuity Hub
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, maxWidth: 540 }}>
              Real-time architectural decisions and operational blockers captured via the Baton Local MCP Server.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button primary onClick={copyHandoverMarkdown}>
              <Icon name={copiedHandoff ? 'check' : 'copy'} size={14} />
              {copiedHandoff ? 'Copied Handover Markdown!' : 'Export Handover Report'}
            </Button>
          </div>
        </div>

        {/* Tab Selector & Search Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            borderBottom: `1px solid ${C.line}`,
            paddingBottom: 16,
            marginBottom: 28
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              ['decisions', `Decisions (${decisions.length})`],
              ['blockers', `Blockers (${blockers.length})`],
              ['mcp', 'MCP Server Status']
            ].map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${activeTab === tabKey ? '#34d39966' : '#27282d'}`,
                  background: activeTab === tabKey ? '#10b98118' : '#141618',
                  color: activeTab === tabKey ? C.green : C.muted,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search query input */}
          <div style={{ minWidth: 260 }}>
            <input
              type="text"
              placeholder="Search decisions or blockers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#121417',
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                padding: '9px 12px',
                color: C.text,
                fontSize: 12,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Tab 1: Decisions */}
        {activeTab === 'decisions' && (
          <div>
            {/* Quick Record Box */}
            <form
              onSubmit={handleCreateDecision}
              style={{
                background: '#131518',
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: '18px 20px',
                marginBottom: 28
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5', marginBottom: 12 }}>
                Record Architectural Decision manually or via MCP (`baton:log_decision`)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Decision (e.g. Switched auth layer to Supabase)"
                  value={newDecision.decision}
                  onChange={(e) => setNewDecision({ ...newDecision, decision: e.target.value })}
                  style={{
                    background: '#0c0d0e',
                    border: `1px solid ${C.line}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: C.text,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Rationale (e.g. Tier limits and managed PostgreSQL support)"
                  value={newDecision.reason}
                  onChange={(e) => setNewDecision({ ...newDecision, reason: e.target.value })}
                  style={{
                    background: '#0c0d0e',
                    border: `1px solid ${C.line}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: C.text,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Files affected (comma separated, e.g. src/lib/supabase.js, package.json)"
                  value={newDecision.files}
                  onChange={(e) => setNewDecision({ ...newDecision, files: e.target.value })}
                  style={{
                    flex: 1,
                    maxWidth: 500,
                    background: '#0c0d0e',
                    border: `1px solid ${C.line}`,
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: C.text,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
                <Button primary type="submit" style={{ padding: '8px 16px', fontSize: 12 }}>
                  + Log Decision
                </Button>
              </div>
            </form>

            {/* Decisions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredDecisions.map((d) => (
                <div
                  key={d.id}
                  style={{
                    background: '#131518',
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: '20px 22px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: C.green,
                          background: '#10b98115',
                          border: '1px solid #284435',
                          padding: '3px 7px',
                          borderRadius: 4,
                          fontWeight: 500
                        }}
                      >
                        ✓ {d.status}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#f4f4f5' }}>
                        {d.decision}
                      </h3>
                    </div>
                    <span style={{ fontSize: 11, color: '#747983', fontFamily: 'monospace' }}>
                      {d.timestamp}
                    </span>
                  </div>

                  <p style={{ fontSize: 13, color: '#a0a4ae', lineHeight: 1.7, margin: '0 0 14px' }}>
                    {d.reason}
                  </p>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        color: '#9ba0ab',
                        background: '#1e2024',
                        padding: '3px 8px',
                        borderRadius: 4
                      }}
                    >
                      {d.citation}
                    </span>
                    {d.files_affected.map((file) => (
                      <span
                        key={file}
                        style={{
                          fontFamily: 'monospace',
                          color: '#7be1b4',
                          background: '#0d1813',
                          border: '1px solid #234836',
                          padding: '2px 7px',
                          borderRadius: 4
                        }}
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Blockers */}
        {activeTab === 'blockers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredBlockers.map((b) => (
              <div
                key={b.id}
                style={{
                  background: '#131518',
                  border: '1px solid #3d2b2b',
                  borderRadius: 8,
                  padding: '20px 22px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: '#ef8585',
                        background: '#ef858515',
                        border: '1px solid #5d2b2b',
                        padding: '3px 7px',
                        borderRadius: 4,
                        fontWeight: 500
                      }}
                    >
                      ● {b.status}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#f4f4f5' }}>
                      {b.problem}
                    </h3>
                  </div>
                  <span style={{ fontSize: 11, color: '#888d96', fontFamily: 'monospace' }}>
                    {b.citation}
                  </span>
                </div>

                <div
                  style={{
                    background: '#0d0f11',
                    border: '1px solid #272a2e',
                    borderRadius: 6,
                    padding: '12px 14px',
                    fontSize: 12,
                    color: '#a0a6b0',
                    lineHeight: 1.7
                  }}
                >
                  <strong style={{ color: '#d0d5dc' }}>Workaround & Next Steps: </strong>
                  {b.workaround_notes}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: MCP Server Status */}
        {activeTab === 'mcp' && (
          <div
            style={{
              background: '#131518',
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: '24px 26px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 8, height: 8, borderRadius: 10, background: C.green }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                Baton Local MCP Server Configured
              </h3>
            </div>

            <p style={{ fontSize: 13, color: '#a0a4ae', lineHeight: 1.8, marginBottom: 20 }}>
              The Baton MCP server is compiled in <code style={{ color: C.green }}>./mcp-server/dist/index.js</code> and configured in <code style={{ color: C.green }}>.antigravity/mcp.json</code>. It automatically intercepts coding agent actions, redacts all secrets client-side via Shannon entropy and regex signatures, and maintains session continuity.
            </p>

            <div
              style={{
                background: '#0c0e10',
                border: '1px solid #23262a',
                borderRadius: 6,
                padding: '16px 18px',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.8,
                color: '#b0b5be'
              }}
            >
              <div><strong>Exposed Tools:</strong></div>
              <div>• <span style={{ color: C.green }}>baton:log_decision</span> - takes decision, reason, alternatives, files_affected</div>
              <div>• <span style={{ color: C.green }}>baton:log_blocker</span> - takes problem, status, workaround_notes</div>
              <div>• <span style={{ color: C.green }}>baton:get_context</span> - takes query and searches continuity memories</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
