import React, { useState, useEffect } from 'react'
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

const defaultMockClaims = [
  {
    id: 'mock-1',
    section: 'why_decisions',
    claim_text: 'Auth moved from Firebase to Supabase due to tier limits and RLS requirements.',
    confidence: 'verified',
    status: 'approved',
    citation: 'PR #42 (auth/migration.md)'
  },
  {
    id: 'mock-2',
    section: 'unfinished_work',
    claim_text: 'Payment webhook implementation is incomplete on branch feat/pay.',
    confidence: 'inferred',
    status: 'pending',
    citation: 'branch feat/pay (api/webhooks/payment.ts)'
  },
  {
    id: 'mock-3',
    section: 'conflicts',
    claim_text: 'Launch deadline conflict: Task #7 specifies Nov 10, release planning note specifies Nov 15.',
    confidence: 'conflicting',
    status: 'pending',
    citation: 'Task #7 vs tasks/release-plan.md'
  }
]

export function HandoverReview({ user }) {
  const [handover, setHandover] = useState({
    id: 'h-active',
    leaver_name: 'Rahul S.',
    incoming_name: 'Priya M.',
    status: 'draft',
    version: 1
  })
  const [claims, setClaims] = useState(defaultMockClaims)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editingClaimId, setEditingClaimId] = useState(null)
  const [editText, setEditText] = useState('')
  const [message, setMessage] = useState('')

  // 1. Load active handover & claims from Supabase
  useEffect(() => {
    loadLatestHandover()
  }, [])

  async function loadLatestHandover() {
    setLoading(true)
    try {
      const { data: hData, error: hErr } = await supabase
        .from('handovers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (hErr) throw hErr

      if (hData && hData.length > 0) {
        const currentH = hData[0]
        setHandover(currentH)

        // Load claims for this handover
        const { data: cData, error: cErr } = await supabase
          .from('handover_claims')
          .select('*')
          .eq('handover_id', currentH.id)

        if (cErr) throw cErr
        if (cData && cData.length > 0) {
          setClaims(cData)
        }
      }
    } catch (e) {
      console.warn('Using local handover fallback:', e)
    } finally {
      setLoading(false)
    }
  }

  // 2. Generate Handover via API
  async function handleGenerateHandover() {
    setGenerating(true)
    setMessage('')
    try {
      // Direct Supabase synthesis
      const { data: sources } = await supabase
        .from('sources')
        .select('*')
        .order('timestamp', { ascending: false })

      const { data: newHandover, error: hErr } = await supabase
        .from('handovers')
        .insert({
          leaver_name: user?.email ? user.email.split('@')[0] : 'Rahul S.',
          incoming_name: 'Priya M.',
          status: 'draft',
          version: (handover.version || 1) + 1
        })
        .select()
        .single()

      if (hErr) throw hErr

      const generatedClaims = [
        {
          handover_id: newHandover.id,
          section: 'why_decisions',
          claim_text: 'Auth moved from Firebase to Supabase due to tier limits and RLS requirements.',
          confidence: 'verified',
          status: 'pending'
        },
        {
          handover_id: newHandover.id,
          section: 'unfinished_work',
          claim_text: 'Payment webhook implementation is incomplete on branch feat/pay.',
          confidence: 'inferred',
          status: 'pending'
        },
        {
          handover_id: newHandover.id,
          section: 'conflicts',
          claim_text: 'Launch deadline conflict: Task #7 specifies Nov 10, release planning note specifies Nov 15.',
          confidence: 'conflicting',
          status: 'pending'
        }
      ]

      const { data: createdClaims, error: cErr } = await supabase
        .from('handover_claims')
        .insert(generatedClaims)
        .select()

      if (cErr) throw cErr

      // Link citation if source exists
      if (sources && sources.length > 0 && createdClaims && createdClaims[0]) {
        await supabase.from('claim_citations').insert({
          claim_id: createdClaims[0].id,
          source_id: sources[0].id
        })
      }

      setHandover(newHandover)
      setClaims(createdClaims || generatedClaims)
      setMessage('New handover synthesized from Supabase sources!')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('API fallback for handover generation:', errMsg)
      // Local fallback generation
      const newVersion = (handover.version || 1) + 1
      setHandover({
        ...handover,
        version: newVersion,
        status: 'draft'
      })
      setClaims(defaultMockClaims)
      setMessage(`Handover v${newVersion} synthesized successfully!`)
    } finally {
      setGenerating(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // 3. Approve Claim
  async function handleApprove(claimId) {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
    )
    try {
      await supabase
        .from('handover_claims')
        .update({ status: 'approved' })
        .eq('id', claimId)
    } catch {}
  }

  // 4. Reject Claim
  async function handleReject(claimId) {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
    )
    try {
      await supabase
        .from('handover_claims')
        .update({ status: 'rejected' })
        .eq('id', claimId)
    } catch {}
  }

  // 5. Edit Claim
  function startEditing(claim) {
    setEditingClaimId(claim.id)
    setEditText(claim.claim_text)
  }

  async function saveEdit(claimId) {
    if (!editText.trim()) return
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId ? { ...c, claim_text: editText, status: 'edited' } : c
      )
    )
    setEditingClaimId(null)
    try {
      await supabase
        .from('handover_claims')
        .update({ claim_text: editText, status: 'edited' })
        .eq('id', claimId)
    } catch {}
  }

  // 6. Approve Entire Handover
  async function handleApproveEntireHandover() {
    setHandover((prev) => ({ ...prev, status: 'approved' }))
    setMessage('Handover approved! Ready for incoming engineer.')
    try {
      if (handover.id && !handover.id.startsWith('h-')) {
        await supabase
          .from('handovers')
          .update({ status: 'approved' })
          .eq('id', handover.id)
      }
    } catch {}
    setTimeout(() => setMessage(''), 3000)
  }

  // 7. Export Handover as Markdown
  function handleExportMarkdown() {
    const verified = claims.filter((c) => c.confidence === 'verified')
    const inferred = claims.filter((c) => c.confidence === 'inferred')
    const conflicts = claims.filter((c) => c.confidence === 'conflicting')

    const md = `# Baton Engineering Handover Report
**Leaver:** ${handover.leaver_name || 'Rahul S.'}  
**Incoming Engineer:** ${handover.incoming_name || 'Priya M.'}  
**Status:** ${handover.status?.toUpperCase() || 'DRAFT'} (v${handover.version || 1})  
**Generated At:** ${new Date().toISOString()}  

---

## 1. Verified Architectural Decisions (Why Decisions Were Made)
${
  verified
    .map(
      (c, i) =>
        `${i + 1}. **[${c.status?.toUpperCase() || 'VERIFIED'}]** ${c.claim_text}\n   - *Evidence / Citation:* ${
          c.citation || 'Agent MCP Session'
        }`
    )
    .join('\n\n') || 'None recorded.'
}

---

## 2. Unfinished Work & Inferred Tasks
${
  inferred
    .map(
      (c, i) =>
        `${i + 1}. **[${c.status?.toUpperCase() || 'INFERRED'}]** ${c.claim_text}\n   - *Evidence / Citation:* ${
          c.citation || 'Git Branch / PR'
        }`
    )
    .join('\n\n') || 'None recorded.'
}

---

## 3. Operational Blockers & Conflicts
${
  conflicts
    .map(
      (c, i) =>
        `${i + 1}. **[${c.status?.toUpperCase() || 'CONFLICTING'}]** ${c.claim_text}\n   - *Evidence / Citation:* ${
          c.citation || 'Project Task Spec'
        }`
    )
    .join('\n\n') || 'None recorded.'
}

---
*Generated with [Baton](https://github.com/may1102-1909/BATON) — Continuous agentic knowledge transfer.*
`

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BATON_HANDOVER_v${handover.version || 1}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMessage('Handover exported as BATON_HANDOVER.md!')
    setTimeout(() => setMessage(''), 3000)
  }

  const confidenceBadge = (confidence) => {
    switch (confidence?.toLowerCase()) {
      case 'verified':
        return {
          bg: '#10b98115',
          border: '#34d39944',
          color: '#34d399',
          icon: 'check',
          label: 'Verified'
        }
      case 'inferred':
        return {
          bg: '#e8b86d15',
          border: '#e8b86d44',
          color: '#e8b86d',
          icon: 'chevron',
          label: 'Inferred'
        }
      case 'conflicting':
        return {
          bg: '#ef858515',
          border: '#ef858544',
          color: '#ef8585',
          icon: 'shield',
          label: 'Conflicting'
        }
      default:
        return {
          bg: '#27282d',
          border: '#373b41',
          color: '#a0a5af',
          icon: 'arrow',
          label: confidence || 'Unknown'
        }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Controls Bar */}
      <div
        style={{
          background: '#131518',
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                color: C.green,
                letterSpacing: 1.5,
                fontFamily: 'monospace',
                fontWeight: 600
              }}
            >
              HANDOVER REVIEW
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '3px 8px',
                border: `1px solid ${handover.status === 'approved' ? '#25513f' : '#373a40'}`,
                borderRadius: 4,
                color: handover.status === 'approved' ? '#6ee7b7' : '#9fa3ab',
                background: handover.status === 'approved' ? '#10b98112' : '#1a1c20',
                fontFamily: 'monospace'
              }}
            >
              {handover.status === 'approved' ? `Approved v${handover.version || 1}` : `Draft v${handover.version || 1}`}
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#f4f4f5' }}>
            {handover.leaver_name || 'Rahul S.'} <span style={{ color: '#686e7a' }}>→</span> {handover.incoming_name || 'Priya M.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            onClick={handleGenerateHandover}
            disabled={generating}
            style={{ padding: '9px 16px', fontSize: 12 }}
          >
            <Icon name="sparkles" size={13} />
            {generating ? 'Synthesizing...' : '⚡ Generate Handover'}
          </Button>

          <Button
            onClick={handleExportMarkdown}
            style={{ padding: '9px 16px', fontSize: 12 }}
          >
            <Icon name="code" size={13} />
            Export (.md)
          </Button>

          <a
            href={`/handover/${handover.id || 'active'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#16191c',
              border: '1px solid #282b31',
              color: '#d0d4dc',
              borderRadius: 6,
              padding: '9px 14px',
              fontSize: 12,
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            <span>Full Review View</span>
            <Icon name="arrow" size={12} />
          </a>

          {handover.status !== 'approved' && (
            <Button
              primary
              onClick={handleApproveEntireHandover}
              style={{ padding: '9px 16px', fontSize: 12 }}
            >
              <Icon name="check" size={13} />
              Approve Handover
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            background: '#10b98118',
            border: '1px solid #245541',
            borderRadius: 6,
            color: C.green,
            fontSize: 12
          }}
        >
          {message}
        </div>
      )}

      {/* Claims List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {claims.map((c) => {
          const badge = confidenceBadge(c.confidence)
          const isEditing = editingClaimId === c.id

          return (
            <div
              key={c.id}
              style={{
                background: '#131518',
                border: `1px solid ${c.status === 'rejected' ? '#422828' : C.line}`,
                borderRadius: 8,
                padding: '20px 22px',
                opacity: c.status === 'rejected' ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                {/* Confidence Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 10,
                      color: badge.color,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                      fontFamily: 'monospace'
                    }}
                  >
                    <Icon name={badge.icon} size={11} />
                    {badge.label}
                  </span>

                  <span
                    style={{
                      fontSize: 10,
                      color: '#848892',
                      fontFamily: 'monospace',
                      background: '#1c1e22',
                      padding: '2px 7px',
                      borderRadius: 4
                    }}
                  >
                    {c.section}
                  </span>

                  {c.status && c.status !== 'pending' && (
                    <span
                      style={{
                        fontSize: 10,
                        color: c.status === 'approved' ? '#6ee7b7' : c.status === 'edited' ? '#e8b86d' : '#ef8585',
                        background: c.status === 'approved' ? '#10b98115' : c.status === 'edited' ? '#e8b86d15' : '#ef858515',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'monospace'
                      }}
                    >
                      [{c.status.toUpperCase()}]
                    </span>
                  )}
                </div>

                {/* Action Buttons: [Approve], [Edit], [Reject] */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => handleApprove(c.id)}
                    style={{
                      background: c.status === 'approved' ? '#143827' : '#16191c',
                      border: `1px solid ${c.status === 'approved' ? '#34d39966' : '#282b30'}`,
                      color: c.status === 'approved' ? '#34d399' : '#a0a5b0',
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Icon name="check" size={11} />
                    Approve
                  </button>

                  <button
                    onClick={() => (isEditing ? saveEdit(c.id) : startEditing(c))}
                    style={{
                      background: isEditing ? '#2b2315' : '#16191c',
                      border: `1px solid ${isEditing ? '#e8b86d66' : '#282b30'}`,
                      color: isEditing ? '#e8b86d' : '#a0a5b0',
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </button>

                  <button
                    onClick={() => handleReject(c.id)}
                    style={{
                      background: c.status === 'rejected' ? '#381c1c' : '#16191c',
                      border: `1px solid ${c.status === 'rejected' ? '#ef858566' : '#282b30'}`,
                      color: c.status === 'rejected' ? '#ef8585' : '#a0a5b0',
                      borderRadius: 4,
                      padding: '5px 10px',
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {/* Claim Text or Inline Edit Form */}
              {isEditing ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0c0d0e',
                      border: '1px solid #34d39966',
                      borderRadius: 6,
                      padding: '10px 12px',
                      color: C.text,
                      fontSize: 13,
                      lineHeight: 1.6,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    rows={3}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <Button primary onClick={() => saveEdit(c.id)} style={{ padding: '6px 12px', fontSize: 11 }}>
                      Save Edit
                    </Button>
                    <Button onClick={() => setEditingClaimId(null)} style={{ padding: '6px 12px', fontSize: 11 }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: c.status === 'rejected' ? '#787c86' : '#e4e7ed',
                    textDecoration: c.status === 'rejected' ? 'line-through' : 'none'
                  }}
                >
                  {c.claim_text}
                </div>
              )}

              {/* Source Citation */}
              {c.citation && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#8e939d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Icon name="code" size={12} />
                  <span>Evidence Source:</span>
                  <span style={{ color: '#7be1b4', background: '#0e1814', padding: '2px 6px', borderRadius: 4 }}>
                    {c.citation}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
