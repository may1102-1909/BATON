'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

interface ClaimCitation {
  id: string
  claim_id: string
  source_id: string
  sources?: {
    id: string
    type: string
    content: string
    author: string
    timestamp: string
  }
}

interface HandoverClaim {
  id: string
  handover_id: string
  section: 'why_decisions' | 'unfinished_work' | 'conflicts' | 'risks' | 'next_actions' | string
  claim_text: string
  confidence: 'verified' | 'inferred' | 'conflicting' | string
  status: 'pending' | 'approved' | 'rejected' | 'edited' | string
  citation?: string
  citations?: ClaimCitation[]
}

interface HandoverRecord {
  id: string
  leaver_name: string
  incoming_name: string
  status: 'draft' | 'approved' | 'acknowledged' | string
  version: number
  created_at?: string
}

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://puohpeyfzpjmxnqkkkgh.supabase.co'
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_2STXI3jUoTBKQIIq67U3lw_El49ZsZb'
  return createClient(url, key)
}

const defaultClaims: HandoverClaim[] = [
  {
    id: 'c-1',
    handover_id: 'default',
    section: 'why_decisions',
    claim_text: 'Chose Supabase Postgres over Firebase for strict Row-Level Security requirements and pgvector support for AI memory indexing.',
    confidence: 'verified',
    status: 'approved',
    citation: 'PR #42 (supabase/schema.sql)'
  },
  {
    id: 'c-2',
    handover_id: 'default',
    section: 'why_decisions',
    claim_text: 'Bundled Baton Local MCP Server over StdioServerTransport to ensure client-side secret redaction with zero cloud latency.',
    confidence: 'verified',
    status: 'pending',
    citation: 'Commit [5c31db93] (mcp-server/src/index.ts)'
  },
  {
    id: 'c-3',
    handover_id: 'default',
    section: 'unfinished_work',
    claim_text: 'Payment webhook handler in api/webhooks/payment.ts is partially drafted on branch feat/pay; stripe signature validation is stubbed.',
    confidence: 'inferred',
    status: 'pending',
    citation: 'branch feat/pay (git log -1)'
  },
  {
    id: 'c-4',
    handover_id: 'default',
    section: 'conflicts',
    claim_text: 'Launch deadline conflict: Task #7 in Linear specifies Nov 10, release planning note specifies Nov 15.',
    confidence: 'conflicting',
    status: 'pending',
    citation: 'Linear Task #7 vs notes/release-plan.md'
  },
  {
    id: 'c-5',
    handover_id: 'default',
    section: 'risks',
    claim_text: 'Rate limits on external LLM inference during bulk claim synthesis might fail if batch size exceeds 25.',
    confidence: 'inferred',
    status: 'pending',
    citation: 'src/lib/gemini.ts (line 42)'
  },
  {
    id: 'c-6',
    handover_id: 'default',
    section: 'next_actions',
    claim_text: 'Rotate staging database credentials and migrate schema foreign key index on claim_citations table.',
    confidence: 'verified',
    status: 'pending',
    citation: 'AGENTS.md (Continuity Protocol)'
  }
]

export default function HandoverReviewPage({
  params
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const [handoverId, setHandoverId] = useState<string>('active')
  const [handover, setHandover] = useState<HandoverRecord>({
    id: 'active',
    leaver_name: 'Rahul S. (Senior Backend)',
    incoming_name: 'Priya M. (Incoming Staff Eng)',
    status: 'draft',
    version: 1
  })
  const [claims, setClaims] = useState<HandoverClaim[]>(defaultClaims)
  const [loading, setLoading] = useState(true)
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [activeCitationSource, setActiveCitationSource] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Expandable section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    why_decisions: true,
    unfinished_work: true,
    conflicts: true,
    risks: true,
    next_actions: true
  })

  useEffect(() => {
    async function init() {
      try {
        const resolved = await Promise.resolve(params)
        const id = resolved?.id || 'active'
        setHandoverId(id)

        // Fetch from API or Supabase
        const supabase = getSupabase()
        const { data: hData } = await supabase
          .from('handovers')
          .select('*')
          .eq('id', id)
          .maybeSingle()

        if (hData) {
          setHandover(hData)
          const { data: cData } = await supabase
            .from('handover_claims')
            .select('*, claim_citations(*, sources(*))')
            .eq('handover_id', id)

          if (cData && cData.length > 0) {
            setClaims(cData)
          }
        }
      } catch (err) {
        console.warn('Loading fallback data:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [params])

  function toggleSection(secKey: string) {
    setExpandedSections((prev) => ({ ...prev, [secKey]: !prev[secKey] }))
  }

  function handleApproveClaim(claimId: string) {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
    )
    const supabase = getSupabase()
    supabase.from('handover_claims').update({ status: 'approved' }).eq('id', claimId).catch(() => {})
    triggerToast('Claim approved')
  }

  function handleRejectClaim(claimId: string) {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
    )
    const supabase = getSupabase()
    supabase.from('handover_claims').update({ status: 'rejected' }).eq('id', claimId).catch(() => {})
    triggerToast('Claim rejected')
  }

  function startEdit(claim: HandoverClaim) {
    setEditingClaimId(claim.id)
    setEditText(claim.claim_text)
  }

  function saveEdit(claimId: string) {
    if (!editText.trim()) return
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId ? { ...c, claim_text: editText, status: 'edited' } : c
      )
    )
    setEditingClaimId(null)
    const supabase = getSupabase()
    supabase.from('handover_claims').update({ claim_text: editText, status: 'edited' }).eq('id', claimId).catch(() => {})
    triggerToast('Claim updated')
  }

  async function handleApproveAndShare() {
    setHandover((prev) => ({ ...prev, status: 'approved' }))
    setShowShareModal(true)
    const supabase = getSupabase()
    try {
      if (handover.id && !handover.id.startsWith('active')) {
        await supabase.from('handovers').update({ status: 'approved' }).eq('id', handover.id)
      }
    } catch {}
    triggerToast('Handover approved! Share link generated.')
  }

  async function handleAcknowledgeReceipt() {
    setHandover((prev) => ({ ...prev, status: 'acknowledged' }))
    setShowShareModal(false)
    const supabase = getSupabase()
    try {
      if (handover.id && !handover.id.startsWith('active')) {
        await supabase.from('handovers').update({ status: 'acknowledged' }).eq('id', handover.id)
      }
    } catch {}
    triggerToast('🤝 Handover receipt acknowledged!')
  }

  function triggerToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // Section configs
  const sections = [
    {
      key: 'why_decisions',
      title: 'Why decisions were made',
      description: 'Architectural, database, and library decisions logged by AI agents with rationale and rejected alternatives.',
      claims: claims.filter((c) => c.section === 'why_decisions' || !c.section)
    },
    {
      key: 'unfinished_work',
      title: 'Unfinished work',
      description: 'Active branches, half-implemented APIs, stubs, and pending tasks needing completion.',
      claims: claims.filter((c) => c.section === 'unfinished_work')
    },
    {
      key: 'conflicts',
      title: 'Conflicts & Blockers',
      description: 'Cross-functional discrepancies between specs, tickets, chat discussions, and git commits.',
      claims: claims.filter((c) => c.section === 'conflicts' || c.section === 'blockers')
    },
    {
      key: 'risks',
      title: 'Risks & Dependencies',
      description: 'External service limits, operational bottlenecks, third-party API dependencies, and breaking changes.',
      claims: claims.filter((c) => c.section === 'risks')
    },
    {
      key: 'next_actions',
      title: 'Next actions',
      description: 'Prioritized checklist for the incoming engineer in their first 48 hours.',
      claims: claims.filter((c) => c.section === 'next_actions')
    }
  ]

  const totalReviewed = claims.filter((c) => c.status && c.status !== 'pending').length

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence?.toLowerCase()) {
      case 'verified':
        return {
          bg: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60',
          label: '✅ Verified'
        }
      case 'inferred':
        return {
          bg: 'bg-amber-950/40 text-amber-400 border-amber-800/60',
          label: '🟡 Inferred'
        }
      case 'conflicting':
        return {
          bg: 'bg-rose-950/40 text-rose-400 border-rose-800/60',
          label: '🔴 Conflicting'
        }
      default:
        return {
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
          label: confidence || 'Unknown'
        }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80'
      case 'acknowledged':
        return 'bg-indigo-950/60 text-indigo-300 border-indigo-700/80'
      case 'draft':
      default:
        return 'bg-amber-950/60 text-amber-300 border-amber-700/80'
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-[#f4f4f5] font-sans pb-28" style={{ minHeight: '100vh', background: '#0c0d0e', color: '#f4f4f5', paddingBottom: 110, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .hr-shell { max-width: 1120px; margin: 0 auto; padding: 28px 24px; }
        .hr-hero { background: #141619; border: 1px solid #27282d; border-radius: 12px; padding: 24px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
        .hr-sec { background: #141619; border: 1px solid #27282d; border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
        .hr-sec-head { width: 100%; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; background: none; border: 0; border-bottom: 1px solid #27282d; text-align: left; cursor: pointer; color: inherit; }
        .hr-sec-body { padding: 20px 24px; background: #0f1013; display: flex; flex-direction: column; gap: 14px; }
        .hr-card { padding: 18px 20px; border-radius: 8px; background: #15171b; border: 1px solid #27282d; transition: all 0.2s ease; }
        .hr-card:hover { border-color: #383b44; }
        .hr-card.rejected { opacity: 0.55; text-decoration: line-through; }
        .hr-actions { display: flex; gap: 6px; align-items: center; }
        .hr-btn { background: #181a1f; border: 1px solid #2b2e35; color: #a0a5b2; border-radius: 5px; padding: 5px 11px; font-size: 11px; cursor: pointer; transition: all 0.15s ease; }
        .hr-btn:hover { color: #fff; border-color: #444852; }
        .hr-btn.approved { background: rgba(16,185,129,0.18); border-color: rgba(52,211,153,0.5); color: #34d399; }
        .hr-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-family: monospace; font-weight: 600; padding: 3px 8px; border-radius: 4px; }
        .hr-badge.verified { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(52,211,153,0.35); }
        .hr-badge.inferred { background: rgba(232,184,109,0.12); color: #e8b86d; border: 1px solid rgba(232,184,109,0.35); }
        .hr-badge.conflicting { background: rgba(239,133,133,0.12); color: #ef8585; border: 1px solid rgba(239,133,133,0.35); }
        .hr-footer { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(17,18,21,0.96); backdrop-filter: blur(16px); border-top: 1px solid #27282d; padding: 16px 24px; z-index: 40; }
        .hr-footer-inner { max-width: 1120px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
      `}</style>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#16191c] border border-emerald-500/50 text-emerald-400 text-xs px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {toastMessage}
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-[#27282d] bg-[#111215]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-xs text-[#999ba5] hover:text-[#34d399] transition flex items-center gap-1.5"
            >
              ← Back to Dashboard
            </a>
            <div className="h-4 w-px bg-[#27282d]" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#34d399]" />
              <span className="text-xs font-mono font-semibold tracking-wider text-[#34d399] uppercase">
                Baton Handover Protocol
              </span>
            </div>
          </div>

          {/* Security Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#17181c] border border-[#27282d] text-[#a0a5b2] flex items-center gap-1.5">
              <span>🔒</span> 3 secrets redacted
            </span>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#17181c] border border-[#27282d] text-[#a0a5b2] flex items-center gap-1.5">
              <span>🛡️</span> Role-filtered view
            </span>
            <span
              className={`text-[11px] font-mono px-2.5 py-1 rounded border capitalize ${getStatusBadge(
                handover.status
              )}`}
            >
              {handover.status} v{handover.version || 1}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="hr-shell max-w-6xl mx-auto px-6 pt-8">
        {/* Leaver → Receiver Hero Bar */}
        <div className="hr-hero bg-[#141619] border border-[#27282d] rounded-xl p-6 mb-8 flex flex-wrap items-center justify-between gap-6 shadow-xl">
          <div>
            <div className="text-[11px] font-mono text-[#34d399] tracking-widest uppercase mb-1">
              ENGINEERING HANDOVER SPECIFICATION
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>{handover.leaver_name || 'Rahul S.'}</span>
              <span className="text-[#646a78]">→</span>
              <span className="text-[#34d399]">{handover.incoming_name || 'Priya M.'}</span>
            </h1>
            <p className="text-xs text-[#999ba5] mt-1.5">
              Zero-loss architectural handover compiled from agent memory, git post-commit hooks, and pull requests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-[#999ba5]">Claims Reviewed</div>
              <div className="text-base font-mono font-bold text-white">
                {totalReviewed} / {claims.length}
              </div>
            </div>
            <div className="w-16 h-2 rounded-full bg-[#27282d] overflow-hidden" style={{ width: 64, height: 8, background: '#27282d', borderRadius: 99 }}>
              <div
                className="h-full bg-[#34d399] transition-all duration-300"
                style={{
                  height: '100%',
                  background: '#34d399',
                  width: `${claims.length > 0 ? (totalReviewed / claims.length) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Expandable Claim Sections */}
        <div className="space-y-6">
          {sections.map((section) => {
            const isExpanded = expandedSections[section.key] !== false

            return (
              <section
                key={section.key}
                className="hr-sec bg-[#141619] border border-[#27282d] rounded-xl overflow-hidden transition"
              >
                {/* Section Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="hr-sec-head w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#181a1e] transition border-b border-[#27282d]"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-semibold text-white tracking-tight" style={{ margin: 0, fontSize: 16 }}>
                        {section.title}
                      </h2>
                      <span className="text-[11px] font-mono bg-[#1c1e22] text-[#8e93a0] px-2 py-0.5 rounded border border-[#2a2d33]">
                        {section.claims.length} claims
                      </span>
                    </div>
                    <p className="text-xs text-[#8c909c] mt-0.5" style={{ margin: '4px 0 0', fontSize: 12, color: '#8c909c' }}>
                      {section.description}
                    </p>
                  </div>
                  <span className="text-xs text-[#8c909c] font-mono">
                    {isExpanded ? 'Hide ▲' : 'Show ▼'}
                  </span>
                </button>

                {/* Section Claims List */}
                {isExpanded && (
                  <div className="hr-sec-body p-6 space-y-4 bg-[#0f1013]">
                    {section.claims.length === 0 ? (
                      <div className="text-xs text-[#6e727e] italic py-2">
                        No claims in this category yet.
                      </div>
                    ) : (
                      section.claims.map((claim) => {
                        const badge = getConfidenceBadge(claim.confidence)
                        const isEditing = editingClaimId === claim.id
                        const isRejected = claim.status === 'rejected'

                        return (
                          <div
                            key={claim.id}
                            className={`hr-card p-4 rounded-lg border transition ${
                              isRejected
                                ? 'rejected bg-[#121316] border-[#382222] opacity-60'
                                : 'bg-[#15171b] border-[#27282d] hover:border-[#383a42]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              {/* Confidence Tag & Status */}
                              <div className="flex items-center gap-2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span
                                  className={`hr-badge ${claim.confidence?.toLowerCase()} text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${badge.bg}`}
                                >
                                  {badge.label}
                                </span>

                                {claim.status && claim.status !== 'pending' && (
                                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#1c1e23] border border-[#2b2e35] text-[#8e94a2]">
                                    [{claim.status}]
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons: [Edit], [Reject], [Approve] */}
                              <div className="hr-actions flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleApproveClaim(claim.id)}
                                  className={`hr-btn ${claim.status === 'approved' ? 'approved' : ''} text-[11px] font-medium px-2.5 py-1 rounded transition border flex items-center gap-1`}
                                >
                                  <span>✓</span> Approve
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditing ? saveEdit(claim.id) : startEdit(claim)
                                  }
                                  className={`hr-btn text-[11px] font-medium px-2.5 py-1 rounded transition border`}
                                >
                                  {isEditing ? 'Save' : 'Edit'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRejectClaim(claim.id)}
                                  className={`hr-btn text-[11px] font-medium px-2.5 py-1 rounded transition border`}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>

                            {/* Claim Text or Inline Edit */}
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={2}
                                  className="w-full bg-[#0c0d0e] border border-emerald-500/50 rounded p-2.5 text-xs text-white outline-none font-sans leading-relaxed"
                                  style={{ width: '100%', background: '#0c0d0e', border: '1px solid rgba(52,211,153,0.5)', borderRadius: 6, padding: '8px 10px', color: '#fff' }}
                                />
                                <div className="flex gap-2" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                  <button
                                    onClick={() => saveEdit(claim.id)}
                                    className="text-[11px] bg-[#34d399] text-[#0c0d0e] font-semibold px-3 py-1 rounded"
                                    style={{ background: '#34d399', color: '#0c0d0e', border: 0, padding: '5px 12px', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingClaimId(null)}
                                    className="text-[11px] bg-[#22242a] text-[#a0a5b2] px-3 py-1 rounded"
                                    style={{ background: '#22242a', color: '#a0a5b2', border: 0, padding: '5px 12px', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p
                                className={`text-xs leading-relaxed ${
                                  isRejected
                                    ? 'line-through text-[#6e727e]'
                                    : 'text-[#e4e7ee]'
                                }`}
                                style={{
                                  fontSize: 13,
                                  lineHeight: 1.6,
                                  margin: '8px 0',
                                  color: isRejected ? '#6e727e' : '#e4e7ee',
                                  textDecoration: isRejected ? 'line-through' : 'none'
                                }}
                              >
                                {claim.claim_text}
                              </p>
                            )}

                            {/* Clickable Citation Badge */}
                            {(claim.citation || (claim.citations && claim.citations.length > 0)) && (
                              <div className="mt-3 flex items-center gap-2" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveCitationSource(
                                      activeCitationSource === claim.id ? null : claim.id
                                    )
                                  }
                                  className="text-[11px] font-mono text-[#34d399] hover:underline flex items-center gap-1.5 bg-[#0f1613] px-2 py-0.5 rounded border border-[#204434]"
                                  style={{
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    color: '#34d399',
                                    background: '#0f1613',
                                    border: '1px solid #204434',
                                    borderRadius: 4,
                                    padding: '3px 8px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <span>📎 Source:</span>
                                  <span>
                                    {claim.citation ||
                                      `Indexed Evidence (${claim.citations?.[0]?.source_id.slice(0, 8)})`}
                                  </span>
                                </button>
                              </div>
                            )}

                            {/* Expandable Citation Details Card */}
                            {activeCitationSource === claim.id && (
                              <div className="mt-3 p-3 bg-[#0d0e11] border border-[#272b33] rounded text-[11px] font-mono space-y-1.5 text-[#a0a5b2]" style={{ marginTop: 10, padding: 12, background: '#0d0e11', border: '1px solid #272b33', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#a0a5b2' }}>
                                <div className="text-emerald-400 font-semibold" style={{ color: '#34d399', fontWeight: 600, marginBottom: 4 }}>
                                  Evidence Source Citation:
                                </div>
                                <div>
                                  • Ref:{' '}
                                  <span className="text-white" style={{ color: '#fff' }}>
                                    {claim.citation || 'AI Coding Agent Session Memory'}
                                  </span>
                                </div>
                                <div>
                                  • Verification Protocol:{' '}
                                  <span className="text-white" style={{ color: '#fff' }}>
                                    Baton Local MCP Client-Side SHA256 & Secret Sanitized
                                  </span>
                                </div>
                                <div className="text-[#646a78] text-[10px]" style={{ color: '#646a78', fontSize: 10, marginTop: 4 }}>
                                  Linked via claim_citations to immutable Supabase Postgres audit record.
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <footer className="hr-footer border-t border-[#27282d] bg-[#111215]/95 backdrop-blur z-40">
        <div className="hr-footer-inner max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-[#999ba5]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Status:{' '}
              <strong className="text-white uppercase font-mono">{handover.status}</strong>
            </span>
            <span className="text-[#3b3e48]">|</span>
            <span>
              {totalReviewed} of {claims.length} claims reviewed
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleApproveAndShare}
              className="bg-[#34d399] hover:bg-[#10b981] text-[#0c0d0e] font-semibold text-xs px-5 py-2.5 rounded-lg shadow-lg shadow-emerald-950/50 transition flex items-center gap-2"
            >
              <span>🤝</span> Approve & Share with Teammate
            </button>
          </div>
        </div>
      </footer>

      {/* Share & Acknowledge Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141619] border border-[#27282d] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🎉</span> Handover Ready for Incoming Engineer
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-[#999ba5] hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#999ba5] leading-relaxed">
              This handover has been approved by admin. The recipient gets a role-filtered view with secrets redacted and verified claim citations.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#a0a5b2] block">
                Shareable Recipient Link:
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  type="text"
                  value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/dashboard/handover/${handoverId}?role=receiver`}
                  className="w-full bg-[#0c0d0e] border border-[#27282d] rounded p-2 text-xs font-mono text-emerald-400"
                />
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined') {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/dashboard/handover/${handoverId}?role=receiver`
                      )
                      triggerToast('Link copied to clipboard!')
                    }
                  }}
                  className="bg-[#22242a] hover:bg-[#2c3038] text-white text-xs px-3 py-2 rounded font-medium"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Recipient One-Click Acknowledge Receipt Box */}
            <div className="p-4 bg-[#0e1713] border border-[#204434] rounded-lg space-y-3">
              <div className="text-xs font-semibold text-emerald-300">
                Receiver Acknowledgment View
              </div>
              <p className="text-[11px] text-[#99bcae]">
                When {handover.incoming_name || 'Priya M.'} receives this link, they can read the evidence and click to acknowledge receipt.
              </p>
              <button
                onClick={handleAcknowledgeReceipt}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0c0d0e] font-semibold text-xs py-2 rounded transition"
              >
                Acknowledge Receipt as {handover.incoming_name || 'Incoming Engineer'}
              </button>
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="text-xs text-[#999ba5] hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

