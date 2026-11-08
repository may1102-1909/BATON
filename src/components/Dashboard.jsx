import React, { useState, useEffect } from 'react'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { Button } from './Button'
import { Preview } from './Preview'
import { supabase } from '../lib/supabase'
import { getDecisions, insertDecision, getBlockers, insertBlocker, getSources } from '../lib/db'
import { useRouter } from '../router'
import { HandoverReview } from './HandoverReview'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

const initialMockDecisions = [
  {
    id: 'dec-rls-pgvector',
    decision: 'Chose Supabase Postgres over Firebase',
    reason: 'Strict Row-Level Security requirements and pgvector support for AI semantic search and agent memory indexing.',
    alternatives: ['Firebase Firestore', 'Custom PostgreSQL with Auth0 and Pinecone'],
    files_affected: ['supabase/schema.sql', 'src/lib/supabase.js', 'src/lib/db.js', '.env.local'],
    status: 'Verified',
    citation: 'baton:log_decision',
    timestamp: 'Just now'
  },
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

const initialMockBlockers = [
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
  const { navigate } = useRouter()
  const [activeTab, setActiveTab] = useState('decisions')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedHandoff, setCopiedHandoff] = useState(false)
  const [newDecision, setNewDecision] = useState({ decision: '', reason: '', files: '' })
  const [decisions, setDecisions] = useState(initialMockDecisions)
  const [blockers, setBlockers] = useState(initialMockBlockers)
  const [sources, setSources] = useState([])
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const [theme, setTheme] = useState('Baton Official')
  const [showSimulateModal, setShowSimulateModal] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simulateSuccess, setSimulateSuccess] = useState('')

  // Load from Supabase on mount & listen to Realtime changes
  useEffect(() => {
    let channel

    async function loadData() {
      const remoteSources = await getSources()
      if (remoteSources && remoteSources.length > 0) {
        setSources(remoteSources)
        setIsSupabaseConnected(true)
      }

      const remoteDecisions = await getDecisions()
      if (remoteDecisions && remoteDecisions.length > 0) {
        setDecisions(remoteDecisions)
        setIsSupabaseConnected(true)
      } else if (remoteDecisions) {
        setIsSupabaseConnected(true)
      }

      const remoteBlockers = await getBlockers()
      if (remoteBlockers && remoteBlockers.length > 0) {
        setBlockers(remoteBlockers)
      }
    }

    loadData()

    // Realtime channel listener
    try {
      channel = supabase
        .channel('baton-realtime-dashboard')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sources' },
          (payload) => {
            setSources((prev) => [payload.new, ...prev.filter((s) => s.id !== payload.new.id)])
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'decisions' },
          (payload) => {
            setDecisions((prev) => [payload.new, ...prev.filter((d) => d.id !== payload.new.id)])
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'blockers' },
          (payload) => {
            setBlockers((prev) => [payload.new, ...prev.filter((b) => b.id !== payload.new.id)])
          }
        )
        .subscribe()
    } catch (e) {
      console.warn('Realtime subscription not active:', e)
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const filteredDecisions = decisions.filter(
    (d) =>
      d.decision?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredBlockers = blockers.filter(
    (b) =>
      b.problem?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.workaround_notes?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  async function handleCreateDecision(e) {
    e.preventDefault()
    if (!newDecision.decision || !newDecision.reason) return
    const filesArray = newDecision.files ? newDecision.files.split(',').map((f) => f.trim()) : []
    const localRecord = {
      id: `dec-${Date.now()}`,
      decision: newDecision.decision,
      reason: newDecision.reason,
      alternatives: ['Evaluated during session'],
      files_affected: filesArray,
      status: 'Verified',
      citation: 'Agent Session',
      created_at: new Date().toISOString(),
      timestamp: 'Just now'
    }

    // Optimistically update UI
    setDecisions([localRecord, ...decisions])
    setNewDecision({ decision: '', reason: '', files: '' })

    // Insert into Supabase if connected
    await insertDecision({
      user_id: user?.id,
      decision: localRecord.decision,
      reason: localRecord.reason,
      alternatives: localRecord.alternatives,
      files_affected: localRecord.files_affected,
      status: 'Verified',
      citation: 'Agent Session'
    })
  }

  function copyHandoverMarkdown() {
    const md = `# BATON HANDOVER REPORT
Generated by Team MUMBAI_WALE for incoming engineers.

## Architectural Decisions
${decisions.map((d) => `- **${d.decision}**: ${d.reason} (Citation: ${d.citation})`).join('\n')}

## Operational Blockers
${blockers.map((b) => `- **[${b.status}] ${b.problem}**: ${b.workaround_notes}`).join('\n')}

*Preserve the reasoning, not just the code.*`

    navigator.clipboard.writeText(md).then(() => {
      setCopiedHandoff(true)
      setTimeout(() => setCopiedHandoff(false), 2500)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      {/* Top Navbar */}
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
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          {/* Left: BATON logo + ROUND 2 · MUMBAI_WALE badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Return to 3D Paper"
            >
              <Brand size={22} />
            </button>
            <span
              style={{
                fontSize: 10,
                color: C.green,
                background: '#10b98115',
                border: '1px solid #284435',
                borderRadius: 4,
                padding: '4px 8px',
                fontFamily: 'monospace',
                fontWeight: 600,
                letterSpacing: 0.5
              }}
            >
              ROUND 2 · MUMBAI_WALE
            </span>
          </div>

          {/* Center: Nav links (Dashboard, Handover Review, Tasks & Claims) */}
          <nav className="bt-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              className="bt-text"
              onClick={() => {
                setActiveTab('decisions')
              }}
              style={{
                fontSize: 12,
                fontWeight: activeTab === 'decisions' || activeTab === 'blockers' ? 600 : 500,
                color: activeTab === 'decisions' || activeTab === 'blockers' ? C.green : C.muted,
                border: 0,
                background: 'none',
                cursor: 'pointer'
              }}
            >
              Dashboard
            </button>
            <button
              className="bt-text"
              onClick={() => {
                navigate('/review')
              }}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: C.muted,
                border: 0,
                background: 'none',
                cursor: 'pointer'
              }}
            >
              Handover Review
            </button>
            <button
              className="bt-text"
              onClick={() => {
                navigate('/tasks')
              }}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: C.muted,
                border: 0,
                background: 'none',
                cursor: 'pointer'
              }}
            >
              Tasks & Claims
            </button>
          </nav>

          {/* Right: Sign In / User profile actions */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ba0a9', fontFamily: 'monospace' }}>
              {user?.email || 'authenticated'}
            </span>
            {user ? (
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
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="bt-text"
                style={{
                  background: 'none',
                  border: '1px solid #303238',
                  borderRadius: 6,
                  padding: '5px 12px',
                  color: C.text,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500
                }}
              >
                Sign In
              </button>
            )}
            <Button onClick={onBack} style={{ padding: '6px 12px', fontSize: 11 }}>
              <Icon name="back" size={12} />
              3D Paper
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace (NO 3D Paper) */}
      <main className="bt-shell" style={{ padding: '36px 0 60px' }}>
        {/* Header Badge: Centered pill badge: ● CodersInPune Hackathon 2026 · Team MUMBAI_WALE */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#34d399',
              background: '#10b98110',
              border: '1px solid #284435',
              borderRadius: 20,
              padding: '6px 16px',
              fontWeight: 500,
              letterSpacing: 0.4
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)'
              }}
            />
            CodersInPune Hackathon 2026 · Team MUMBAI_WALE
          </span>
        </div>

        {/* Section Heading & Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            marginBottom: 28,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 8px', letterSpacing: -0.6 }}>
              Engineering Handover & Continuity Workspace
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.6 }}>
              Automated reasoning captured from MCP agent sessions, git pull requests, and commit citations.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                padding: '5px 10px',
                borderRadius: 4,
                border: '1px solid #27282d',
                background: isSupabaseConnected ? '#10b98110' : '#141619',
                color: isSupabaseConnected ? C.green : '#999ba5'
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 10,
                  background: isSupabaseConnected ? C.green : '#f59e0b'
                }}
              />
              {isSupabaseConnected ? 'SUPABASE LIVE' : 'LOCAL MEMORY CACHE'}
            </span>

            <Button primary onClick={copyHandoverMarkdown} style={{ padding: '8px 14px', fontSize: 12 }}>
              <Icon name="check" size={13} />
              {copiedHandoff ? 'Copied Markdown!' : 'Export Handover Manifest'}
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            borderBottom: `1px solid ${C.line}`,
            marginBottom: 24,
            paddingBottom: 4
          }}
        >
          {[
            ['decisions', `Architectural Decisions (${decisions.length})`],
            ['blockers', `Operational Blockers (${blockers.length})`],
            ['review', 'Handover Review Spec'],
            ['mcp', 'MCP Server Status']
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                background: 'none',
                border: 0,
                borderBottom: activeTab === id ? `2px solid ${C.green}` : '2px solid transparent',
                color: activeTab === id ? C.text : C.muted,
                fontSize: 13,
                fontWeight: activeTab === id ? 600 : 500,
                padding: '8px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          ))}
        </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['review', '⚡ Review Handover'],
              ['decisions', `Decisions (${decisions.length})`],
              ['sources', `Agent Sources (${sources.length})`],
              ['blockers', `Blockers (${blockers.length})`],
              ['mcp', 'MCP Status']
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

        {/* Search & Filter Bar */}
        {(activeTab === 'decisions' || activeTab === 'blockers') && (
          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              placeholder={`Search ${activeTab === 'decisions' ? 'decisions, reasons, alternatives...' : 'blockers, notes...'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#131518',
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                padding: '10px 14px',
                color: C.text,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>
        )}

        {/* Tab 0: Handover Review */}
        {activeTab === 'review' && <HandoverReview user={user} />}

        {/* Tab 1: Decisions */}
        {activeTab === 'decisions' && (
          <div>
            {/* Quick Add Form */}
            <form
              onSubmit={handleCreateDecision}
              style={{
                background: '#121417',
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: 18,
                marginBottom: 24
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 12, fontFamily: 'monospace' }}>
                + LOG ARCHITECTURAL DECISION (DISPATCH VIA BATON MCP)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Decision summary (e.g. Migrated state to Zustand)"
                  value={newDecision.decision}
                  onChange={(e) => setNewDecision({ ...newDecision, decision: e.target.value })}
                  style={{
                    background: '#0c0d0e',
                    border: '1px solid #282a30',
                    borderRadius: 4,
                    padding: '8px 12px',
                    color: C.text,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Affected files comma-separated (e.g. src/store.js, src/App.jsx)"
                  value={newDecision.files}
                  onChange={(e) => setNewDecision({ ...newDecision, files: e.target.value })}
                  style={{
                    background: '#0c0d0e',
                    border: '1px solid #282a30',
                    borderRadius: 4,
                    padding: '8px 12px',
                    color: C.text,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Rationale & why alternatives were discarded..."
                  value={newDecision.reason}
                  onChange={(e) => setNewDecision({ ...newDecision, reason: e.target.value })}
                  style={{
                    flex: 1,
                    background: '#0c0d0e',
                    border: '1px solid #282a30',
                    borderRadius: 4,
                    padding: '8px 12px',
                    color: C.text,
                    fontSize: 12,
                    outline: 'none'
                  }}
                />
                <Button primary type="submit" style={{ padding: '8px 16px', fontSize: 12 }}>
                  Log Decision
                </Button>
              </div>
            </form>

            {/* Decision Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredDecisions.map((d) => (
                <div
                  key={d.id}
                  style={{
                    background: '#131518',
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: '18px 20px',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
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
                        ✓ {d.status || 'Verified'}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#f4f4f5' }}>
                        {d.decision}
                      </h3>
                    </div>
                    <span style={{ fontSize: 11, color: '#888d96', fontFamily: 'monospace' }}>
                      {d.citation}
                    </span>
                  </div>

                  <p style={{ fontSize: 13, color: '#a0a6b0', margin: '0 0 14px', lineHeight: 1.6 }}>
                    {d.reason}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 10, borderTop: '1px solid #1f2227' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.files_affected?.map((f) => (
                        <span
                          key={f}
                          style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: '#9095a0',
                            background: '#0d0e10',
                            border: '1px solid #24272c',
                            padding: '2px 7px',
                            borderRadius: 4
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: '#6a6e78', fontFamily: 'monospace' }}>
                      {d.timestamp || 'Recorded by Baton'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Operational Blockers */}
        {/* Tab 2: Agent Dispatched Sources */}
        {activeTab === 'sources' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sources.length === 0 ? (
              <div
                style={{
                  background: '#131518',
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: C.muted
                }}
              >
                <div style={{ fontSize: 13, marginBottom: 8, color: '#f4f4f5' }}>
                  No agent sources indexed in Supabase yet.
                </div>
                <div style={{ fontSize: 11 }}>
                  Dispatches from Baton MCP tools (`baton:log_decision`, `baton:log_blocker`) will stream here in real-time.
                </div>
              </div>
            ) : (
              sources.map((src) => (
                <div
                  key={src.id}
                  style={{
                    background: '#131518',
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: '20px 22px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: C.green,
                          background: '#10b98115',
                          border: '1px solid #284435',
                          padding: '3px 8px',
                          borderRadius: 4
                        }}
                      >
                        {src.author || 'Antigravity Agent'}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: src.type?.includes('blocker') ? '#ef8585' : '#7be1b4',
                          background: src.type?.includes('blocker') ? '#ef858515' : '#10b98115',
                          border: `1px solid ${src.type?.includes('blocker') ? '#5d2b2b' : '#234836'}`,
                          padding: '3px 7px',
                          borderRadius: 4
                        }}
                      >
                        {src.type}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#747983', fontFamily: 'monospace' }}>
                      {new Date(src.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      background: '#0d0f11',
                      border: '1px solid #24272c',
                      borderRadius: 6,
                      padding: '14px 16px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                      lineHeight: 1.8,
                      color: '#d4d8e0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {src.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Blockers */}
        {activeTab === 'blockers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredBlockers.map((b) => (
              <div
                key={b.id}
                style={{
                  background: '#131518',
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: '18px 20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
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

        {/* Tab 3: Handover Review Spec (renders Preview component) */}
        {activeTab === 'review' && (
          <div style={{ marginTop: 10 }}>
            <Preview expanded={0} setExpanded={() => {}} />
          </div>
        )}

        {/* Tab 4: MCP Server Status */}
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

      {/* Bottom Bar: Explore Dashboard, View Handover Review, Theme Switcher */}
      <div
        style={{
          borderTop: `1px solid ${C.line}`,
          borderBottom: `1px solid ${C.line}`,
          background: '#0d0f12',
          padding: '18px 0',
          marginTop: 60
        }}
      >
        <div
          className="bt-shell"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              primary={activeTab === 'decisions'}
              onClick={() => {
                setActiveTab('decisions')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              style={{ padding: '8px 14px', fontSize: 12 }}
            >
              <Icon name="code" size={13} />
              Explore Dashboard
            </Button>
            <Button
              primary={activeTab === 'review'}
              onClick={() => {
                navigate('/review')
              }}
              style={{ padding: '8px 14px', fontSize: 12 }}
            >
              <Icon name="arrow" size={13} />
              View Handover Review
            </Button>
          </div>

          {/* 3D Theme Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#888d96', fontFamily: 'monospace' }}>
              3D Theme:
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                ['Baton Official', 'original'],
                ['Certificate', 'certificate'],
                ['Nocturne', 'nocturne'],
                ['Japanese', 'japanese']
              ].map(([themeName]) => (
                <button
                  key={themeName}
                  onClick={() => setTheme(themeName)}
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: `1px solid ${theme === themeName ? '#10b981' : '#282b30'}`,
                    background: theme === themeName ? '#10b98120' : '#141619',
                    color: theme === themeName ? '#34d399' : '#a0a5af',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {themeName}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: BATON — Pass the knowledge, not just the code. & Hackathon Meta Tags */}
      <footer style={{ background: '#0a0b0d', padding: '32px 0' }}>
        <div
          className="bt-shell"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Brand size={20} />
            <span style={{ fontSize: 12, color: '#a0a5af' }}>
              BATON — Pass the knowledge, not just the code.
            </span>
          </div>

          <div
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#6e737d',
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap'
            }}
          >
            <span>CodersInPune Hackathon 2026</span>
            <span>·</span>
            <span>Track: Full Stack</span>
            <span>·</span>
            <span style={{ color: C.green }}>Team MUMBAI_WALE</span>
            <span>·</span>
            <span>Round 2 Build</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Dashboard
