import React from 'react'

// Before/after shown as a pull-request diff: each topic is a hunk, the old way removed, the Baton way added.
const hunks = [
  {
    topic: 'Architectural decisions',
    without: 'Scattered across Slack threads, Google Docs and 1-on-1 calls nobody wrote down.',
    with: 'Pulled from commits, pull requests and the AI agent sessions where the decision was made.'
  },
  {
    topic: 'Can I trust this note?',
    without: 'No way to tell whether a note is current or a guess from six months ago.',
    with: 'Every claim cites the record it came from and is marked Verified, Inferred, Missing or Conflicting.'
  },
  {
    topic: 'Secrets',
    without: 'API keys and .env values get pasted into the handover doc "just for now".',
    with: 'Keys and tokens are redacted before anything is stored, and each reader only sees their role’s records.'
  },
  {
    topic: 'First week for the new engineer',
    without: 'Digging through old threads and messaging someone who has already left.',
    with: 'A reviewed handover with cited answers to their questions, ready on day one.'
  }
]

const mono = 'var(--mono)'
const line = '#27282d'

function DiffLine({ sign, num, text }) {
  const added = sign === '+'
  return (
    <div className="usage-diff-line" style={{ display: 'grid', gridTemplateColumns: '44px 20px 1fr', background: added ? 'rgba(52, 211, 153, 0.09)' : 'rgba(248, 81, 73, 0.08)' }}>
      <span style={{ fontFamily: mono, fontSize: 12, color: '#6e7681', textAlign: 'right', padding: '6px 10px 6px 0', background: added ? 'rgba(52, 211, 153, 0.13)' : 'rgba(248, 81, 73, 0.12)', userSelect: 'none' }}>
        {num}
      </span>
      <span style={{ fontFamily: mono, fontSize: 13, color: added ? '#34d399' : '#f47067', textAlign: 'center', padding: '6px 0', userSelect: 'none' }}>
        {sign}
      </span>
      <span style={{ fontSize: 14, lineHeight: 1.55, color: added ? '#e6edf3' : '#adb3bc', padding: '6px 14px 6px 2px' }}>{text}</span>
    </div>
  )
}

export function Comparison() {
  return (
    <section>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0, paddingBottom: 10, borderBottom: `1px solid ${line}`, color: '#f4f4f5' }}>
        Stop losing tribal knowledge with every departure.
      </h2>
      <p style={{ fontSize: 14, color: '#999ba5', margin: '12px 0 20px', lineHeight: 1.6 }}>
        The same handover, before and after Baton.
      </p>

      <div style={{ border: `1px solid ${line}`, borderRadius: 6, overflow: 'hidden', background: '#0d0e10' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 14px', background: '#141518', borderBottom: `1px solid ${line}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: mono, fontSize: 12.5, color: '#e6edf3', minWidth: 0 }}>
            <span style={{ color: '#6e7681' }}>handover/</span>vikrant-to-krishna.md
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: 12 }}>
            <span style={{ color: '#34d399' }}>+{hunks.length}</span>
            <span style={{ color: '#f47067' }}>−{hunks.length}</span>
            <span aria-hidden="true" style={{ display: 'flex', gap: 2 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: 1, background: i < 2 ? '#34d399' : i < 4 ? '#f47067' : '#3a3d44' }} />
              ))}
            </span>
          </span>
        </div>
        {hunks.map((h, i) => (
          <div key={h.topic}>
            <div style={{ fontFamily: mono, fontSize: 12, color: '#8b949e', padding: '6px 14px', background: 'rgba(52, 211, 153, 0.04)', borderTop: i ? `1px solid ${line}` : undefined }}>
              @@ {h.topic} @@
            </div>
            <DiffLine sign="−" num={i * 2 + 1} text={h.without} />
            <DiffLine sign="+" num={i * 2 + 1} text={h.with} />
          </div>
        ))}
      </div>
    </section>
  )
}
