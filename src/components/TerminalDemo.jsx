import React, { useState } from 'react'
import { Icon } from './Icon'

const snippets = {
  cli: {
    command: 'npx baton generate --branch=main --role=backend',
    output: [
      { text: '🔍 Scanning 48 pull requests & 142 commits...', color: '#9da3ae' },
      { text: '🤖 Parsing agent conversation traces (Claude, Cursor)...', color: '#9da3ae' },
      { text: '🛡️  Redacting 3 secrets (STRIPE_SECRET, AWS_SESSION_TOKEN)...', color: '#e8b86d' },
      { text: '✓  Generated 3 verified architectural citations', color: '#34d399' },
      { text: '✓  Flagged 1 conflicting milestone deadline (PR #42 vs Task #7)', color: '#ef8585' },
      { text: '📦 Handover package ready -> ./baton/handover-core.json', color: '#6ee7b7' }
    ]
  },
  action: {
    command: 'uses: baton-ai/handover-action@v1',
    output: [
      { text: 'name: Generate Baton Handover on PR Merge', color: '#6ee7b7' },
      { text: 'on:', color: '#9da3ae' },
      { text: '  pull_request:', color: '#9da3ae' },
      { text: '    types: [closed]', color: '#9da3ae' },
      { text: 'jobs:', color: '#9da3ae' },
      { text: '  handover:', color: '#9da3ae' },
      { text: '    runs-on: ubuntu-latest', color: '#9da3ae' },
      { text: '    steps:', color: '#9da3ae' },
      { text: '      - uses: actions/checkout@v4', color: '#9da3ae' },
      { text: '      - uses: baton-ai/handover-action@v1', color: '#34d399' },
      { text: '        with:', color: '#9da3ae' },
      { text: '          output-dir: ./handover-artifacts', color: '#9da3ae' }
    ]
  },
  agent: {
    command: '@baton export --scope=milestone-v2',
    output: [
      { text: '[agent] Ingesting multi-turn coding session logs...', color: '#9da3ae' },
      { text: '[agent] Extracting architectural rationale:', color: '#34d399' },
      { text: '  • Migrated auth layer from Firebase to Supabase (tier limits)', color: '#f4f4f5' },
      { text: '  • Inlined tailwind engine to reduce client bundle by 48kb', color: '#f4f4f5' },
      { text: '[agent] Verified all claims against target repository HEAD', color: '#34d399' },
      { text: '[agent] Exported signed handover to incoming engineer', color: '#6ee7b7' }
    ]
  }
}

export function TerminalDemo() {
  const [tab, setTab] = useState('cli')
  const [copied, setCopied] = useState(false)

  const activeSnippet = snippets[tab]

  function copyCommand() {
    navigator.clipboard.writeText(activeSnippet.command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section style={{ padding: '60px 0', scrollMarginTop: 90 }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div
          style={{
            color: '#34d399',
            fontSize: 10,
            letterSpacing: 1.7,
            fontFamily: 'monospace',
            marginBottom: 10,
            fontWeight: 600
          }}
        >
          DEVELOPER WORKFLOW
        </div>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: -1,
            margin: '0 0 10px',
            color: '#f4f4f5'
          }}
        >
          Fits into the tools you already run.
        </h2>
        <p
          style={{
            fontSize: 13,
            color: '#999ba5',
            margin: '0 auto',
            maxWidth: 500,
            lineHeight: 1.8
          }}
        >
          No heavy enterprise dashboards. Run Baton from your local terminal, trigger it automatically in CI/CD, or invoke it directly from your AI agent.
        </p>
      </div>

      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
          background: '#121417',
          border: '1px solid #282a30',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: '#0d0f11',
            borderBottom: '1px solid #23252a'
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: '#e05757' }} />
            <span style={{ width: 10, height: 10, borderRadius: 10, background: '#e5a440' }} />
            <span style={{ width: 10, height: 10, borderRadius: 10, background: '#3ecf8e' }} />
            <span
              style={{
                marginLeft: 10,
                fontSize: 11,
                color: '#7b8089',
                fontFamily: 'monospace'
              }}
            >
              baton-cli ~ bash
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              ['cli', 'CLI (npx)'],
              ['action', 'GitHub Action'],
              ['agent', 'AI Agent Hook']
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: `1px solid ${tab === key ? '#34d39955' : 'transparent'}`,
                  background: tab === key ? '#10b98118' : 'transparent',
                  color: tab === key ? '#34d399' : '#888d96',
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Command bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: '#15171b',
            borderBottom: '1px solid #23252a',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            color: '#34d399'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#686e7a' }}>$</span>
            <span>{activeSnippet.command}</span>
          </div>
          <button
            onClick={copyCommand}
            style={{
              background: '#20242a',
              border: '1px solid #323740',
              borderRadius: 4,
              color: '#d0d4dc',
              fontSize: 11,
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={12} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Output Area */}
        <div
          style={{
            padding: '20px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            lineHeight: 1.85,
            background: '#0c0e10',
            minHeight: 180
          }}
        >
          {activeSnippet.output.map((line, idx) => (
            <div key={idx} style={{ color: line.color }}>
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

