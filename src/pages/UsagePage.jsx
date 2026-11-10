import React, { useState, useEffect, useRef } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Comparison } from '../components/Comparison'
import { CtaBanner } from '../components/CtaBanner'
import { useRouter } from '../router'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

const NAV_ITEMS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'features',     label: 'Features' },
  { id: 'workflow',     label: 'Workflow' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'docs',         label: 'Developer Notes' },
]

const PRESET_SCENARIOS = [
  {
    label: '🔑 Leaked Secret',
    text: 'Migrated billing webhook to Stripe live API; secret key sk_live_99x418Fq9K001 with 120s timeout'
  },
  {
    label: '⚡ Architecture Decision',
    text: 'Replaced Firebase auth with Supabase client to bypass 50k MAU limit; anon key eyJhbGciOiJIUzI1NiI'
  },
  {
    label: '🛡️ Workaround / Debt',
    text: 'Workaround applied in router.jsx: bypassed CORS preflight caching bug on staging cluster'
  }
]

const WORKFLOW_SNIPPETS = {
  cli: {
    title: 'baton-cli ~ bash',
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
    title: 'github-actions ~ workflow.yml',
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
    title: 'ai-agent ~ stdio',
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

function DeveloperNotesCard() {
  const [hoveredDev, setHoveredDev] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e, dev) => {
    setHoveredDev(dev)
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    setHoveredDev(null)
  }

  const isNearRightEdge = typeof window !== 'undefined' && mousePos.x > window.innerWidth - 180

  return (
    <div
      style={{
        maxWidth: 780,
        margin: '50px auto 0',
        position: 'relative',
        background: '#111316',
        border: '1px solid #282a30',
        borderRadius: '18px 18px 36px 36px',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(52, 211, 153, 0.08)',
        padding: '36px 28px 40px',
      }}
    >
      {/* Floating Cursor Pill Bubble (Reference: ricco.codes) */}
      {hoveredDev && (
        <div
          style={{
            position: 'fixed',
            left: isNearRightEdge ? mousePos.x - 165 : mousePos.x + 14,
            top: mousePos.y - 12,
            pointerEvents: 'none',
            zIndex: 999999,
            background: '#86efac',
            color: '#06281e',
            borderRadius: 9999,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(52, 211, 153, 0.35)',
            transform: 'translate3d(0, 0, 0)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            transition: 'opacity 0.1s ease',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>{hoveredDev === 'dev2' ? 'may1102-1909' : 'vikrannntttt8'}</span>
          <span style={{ fontSize: 13, fontWeight: 800, transform: 'translateY(-0.5px)' }}>↗</span>
        </div>
      )}

      {/* Top-Left Sticker (Dev 1 - Glasses Avatar) */}
      <a
        href="https://github.com/vikrannntttt8/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Dev 1 GitHub Profile (vikrannntttt8)"
        onMouseEnter={(e) => handleMouseMove(e, 'dev1')}
        onMouseMove={(e) => handleMouseMove(e, 'dev1')}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: -55,
          left: -30,
          width: 115,
          height: 115,
          zIndex: 20,
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'block',
          outline: 'none',
        }}
      >
        <img
          src="/stickers/dev-glasses.png"
          alt="Dev 1 (Glasses)"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: hoveredDev === 'dev1' ? 'rotate(-3deg) scale(1.12)' : 'rotate(-7deg) scale(1)',
            filter: hoveredDev === 'dev1'
              ? 'drop-shadow(0 0 22px rgba(52, 211, 153, 0.65)) drop-shadow(0 16px 32px rgba(0, 0, 0, 0.85))'
              : 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.75))',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />
      </a>

      {/* Top-Right Sticker (Dev 2 - Mustache Avatar) */}
      <a
        href="https://github.com/may1102-1909"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Dev 2 GitHub Profile (may1102-1909)"
        onMouseEnter={(e) => handleMouseMove(e, 'dev2')}
        onMouseMove={(e) => handleMouseMove(e, 'dev2')}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: -55,
          right: -30,
          width: 115,
          height: 115,
          zIndex: 20,
          cursor: 'pointer',
          textDecoration: 'none',
          display: 'block',
          outline: 'none',
        }}
      >
        <img
          src="/stickers/dev-mustache.png"
          alt="Dev 2 (Mustache)"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: hoveredDev === 'dev2' ? 'rotate(3deg) scale(1.12)' : 'rotate(7deg) scale(1)',
            filter: hoveredDev === 'dev2'
              ? 'drop-shadow(0 0 22px rgba(52, 211, 153, 0.65)) drop-shadow(0 16px 32px rgba(0, 0, 0, 0.85))'
              : 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.75))',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />
      </a>

      {/* Minimal WhatsApp / Chat Bubble Conversation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 10 }}>
        {/* Message 1 (Dev 1, Left) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: '82%' }}>
          <a
            href="https://github.com/vikrannntttt8/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dev 1 GitHub Profile"
            onMouseEnter={(e) => handleMouseMove(e, 'dev1')}
            onMouseMove={(e) => handleMouseMove(e, 'dev1')}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer', flexShrink: 0, textDecoration: 'none', display: 'inline-block' }}
          >
            <img
              src="/stickers/dev-glasses.png"
              alt="Dev 1"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1.5px solid #34d399',
                background: '#121417',
                display: 'block',
                marginTop: 2,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                transform: hoveredDev === 'dev1' ? 'scale(1.15)' : 'scale(1)',
                boxShadow: hoveredDev === 'dev1' ? '0 0 12px rgba(52,211,153,0.5)' : 'none'
              }}
            />
          </a>
          <div>
            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, fontFamily: 'monospace', marginBottom: 4, marginLeft: 2 }}>
              Dev 1
            </div>
            <div
              style={{
                background: '#191c22',
                border: '1px solid #282c35',
                borderRadius: '3px 16px 16px 16px',
                padding: '12px 16px',
                fontSize: 13,
                color: '#e2e5eb',
                lineHeight: 1.65,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              Bro, when developers leave, all the architectural reasoning evaporates into deleted Slack threads and lost Jira tickets. How do we capture decisions live without forcing engineers to write tedious manual docs?
              <div style={{ fontSize: 9, color: '#686e7a', textAlign: 'right', marginTop: 4, fontFamily: 'monospace' }}>10:42 PM</div>
            </div>
          </div>
        </div>

        {/* Message 2 (Dev 2, Right - The MCP Eureka Moment) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', alignSelf: 'flex-end', flexDirection: 'row-reverse', maxWidth: '84%' }}>
          <a
            href="https://github.com/may1102-1909"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dev 2 GitHub Profile"
            onMouseEnter={(e) => handleMouseMove(e, 'dev2')}
            onMouseMove={(e) => handleMouseMove(e, 'dev2')}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer', flexShrink: 0, textDecoration: 'none', display: 'inline-block' }}
          >
            <img
              src="/stickers/dev-mustache.png"
              alt="Dev 2"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1.5px solid #34d399',
                background: '#121417',
                display: 'block',
                marginTop: 2,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                transform: hoveredDev === 'dev2' ? 'scale(1.15)' : 'scale(1)',
                boxShadow: hoveredDev === 'dev2' ? '0 0 12px rgba(52,211,153,0.5)' : 'none'
              }}
            />
          </a>
          <div>
            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, fontFamily: 'monospace', marginBottom: 4, marginRight: 2, textAlign: 'right' }}>
              Dev 2
            </div>
            <div
              style={{
                background: '#0d261b',
                border: '1px solid #1e4f39',
                borderRadius: '16px 3px 16px 16px',
                padding: '12px 16px',
                fontSize: 13,
                color: '#e2f7ed',
                lineHeight: 1.65,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              That&apos;s exactly why I pitched turning Baton into a local <strong style={{ color: '#34d399' }}>Model Context Protocol (MCP)</strong> server! Since everyone is already coding with Claude, Cursor, and AI agents, Baton hooks straight into the agent runtime via MCP over stdio. Every architectural choice, decision rationale, and unmerged git context gets intercepted automatically while you code.
              <div style={{ fontSize: 9, color: '#34d399aa', textAlign: 'right', marginTop: 4, fontFamily: 'monospace' }}>10:43 PM · ✓✓</div>
            </div>
          </div>
        </div>

        {/* Message 3 (Dev 1, Left) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: '82%' }}>
          <a
            href="https://github.com/vikrannntttt8/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dev 1 GitHub Profile"
            onMouseEnter={(e) => handleMouseMove(e, 'dev1')}
            onMouseMove={(e) => handleMouseMove(e, 'dev1')}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer', flexShrink: 0, textDecoration: 'none', display: 'inline-block' }}
          >
            <img
              src="/stickers/dev-glasses.png"
              alt="Dev 1"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1.5px solid #34d399',
                background: '#121417',
                display: 'block',
                marginTop: 2,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                transform: hoveredDev === 'dev1' ? 'scale(1.15)' : 'scale(1)',
                boxShadow: hoveredDev === 'dev1' ? '0 0 12px rgba(52,211,153,0.5)' : 'none'
              }}
            />
          </a>
          <div>
            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, fontFamily: 'monospace', marginBottom: 4, marginLeft: 2 }}>
              Dev 1
            </div>
            <div
              style={{
                background: '#191c22',
                border: '1px solid #282c35',
                borderRadius: '3px 16px 16px 16px',
                padding: '12px 16px',
                fontSize: 13,
                color: '#e2e5eb',
                lineHeight: 1.65,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              Bro that MCP integration is clutch. And because the MCP daemon runs quietly on localhost, our Shannon entropy engine scrubs Stripe keys, AWS tokens, and secrets client-side before any handover note is compiled.
              <div style={{ fontSize: 9, color: '#686e7a', textAlign: 'right', marginTop: 4, fontFamily: 'monospace' }}>10:44 PM</div>
            </div>
          </div>
        </div>

        {/* Message 4 (Dev 2, Right) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', alignSelf: 'flex-end', flexDirection: 'row-reverse', maxWidth: '84%' }}>
          <a
            href="https://github.com/may1102-1909"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dev 2 GitHub Profile"
            onMouseEnter={(e) => handleMouseMove(e, 'dev2')}
            onMouseMove={(e) => handleMouseMove(e, 'dev2')}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer', flexShrink: 0, textDecoration: 'none', display: 'inline-block' }}
          >
            <img
              src="/stickers/dev-mustache.png"
              alt="Dev 2"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1.5px solid #34d399',
                background: '#121417',
                display: 'block',
                marginTop: 2,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                transform: hoveredDev === 'dev2' ? 'scale(1.15)' : 'scale(1)',
                boxShadow: hoveredDev === 'dev2' ? '0 0 12px rgba(52,211,153,0.5)' : 'none'
              }}
            />
          </a>
          <div>
            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 600, fontFamily: 'monospace', marginBottom: 4, marginRight: 2, textAlign: 'right' }}>
              Dev 2
            </div>
            <div
              style={{
                background: '#0d261b',
                border: '1px solid #1e4f39',
                borderRadius: '16px 3px 16px 16px',
                padding: '12px 16px',
                fontSize: 13,
                color: '#e2f7ed',
                lineHeight: 1.65,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              Exactly. Zero cloud leakage, live agent telemetry, and verified AST-grounded handovers ready in 30 seconds. Pass the knowledge, not just the code. 🤝
              <div style={{ fontSize: 9, color: '#34d399aa', textAlign: 'right', marginTop: 4, fontFamily: 'monospace' }}>10:45 PM · ✓✓</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, #262931 25%, #262931 75%, transparent 100%)',
        margin: '0 auto',
        maxWidth: 1000
      }}
    />
  )
}

function UnifiedWorkflowConsole() {
  const [tab, setTab] = useState('interactive') // 'interactive' | 'cli' | 'action' | 'agent'
  const [inputText, setInputText] = useState(PRESET_SCENARIOS[0].text)
  const [step, setStep] = useState('idle') // 'idle' | 'capturing' | 'auditing' | 'verified'
  const [detectedSecret, setDetectedSecret] = useState(null)
  const [copiedHandover, setCopiedHandover] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const handleRun = () => {
    if (!inputText.trim()) return
    setStep('capturing')

    const secretMatch = inputText.match(/(sk_live_[a-zA-Z0-9]+|eyJ[a-zA-Z0-9_\-.]+|[a-zA-Z0-9]{20,})/i)
    const foundSecret = secretMatch ? secretMatch[0] : null
    setDetectedSecret(foundSecret)

    setTimeout(() => {
      setStep('auditing')
      setTimeout(() => {
        setStep('verified')
      }, 650)
    }, 550)
  }

  const handleReset = () => {
    setStep('idle')
    setDetectedSecret(null)
  }

  const handleCopyHandover = () => {
    const handoverJson = JSON.stringify({
      version: 'baton/v1',
      record_id: 'BATON-884',
      status: 'VERIFIED',
      clearance: 'ROLE_BACKEND',
      rationale: detectedSecret ? inputText.replace(detectedSecret, '[REDACTED_CLIENT_SIDE]') : inputText,
      quarantined_secrets: detectedSecret ? 1 : 0,
      ast_grounded: true,
      branch: 'main'
    }, null, 2)

    navigator.clipboard?.writeText(handoverJson)
    setCopiedHandover(true)
    setTimeout(() => setCopiedHandover(false), 2000)
  }

  const handleCopyCommand = (text) => {
    navigator.clipboard?.writeText(text)
    setCopiedCommand(true)
    setTimeout(() => setCopiedCommand(false), 2000)
  }

  const activeSnippet = WORKFLOW_SNIPPETS[tab]

  return (
    <div
      style={{
        maxWidth: 780,
        margin: '0 auto',
        background: '#121417',
        border: '1px solid #282a30',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(52, 211, 153, 0.08)'
      }}
    >
      {/* Terminal / Console Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: '#0d0f11',
          borderBottom: '1px solid #23252a',
          flexWrap: 'wrap',
          gap: 12
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
            {tab === 'interactive' ? 'baton-simulator ~ shannon-audit' : activeSnippet.title}
          </span>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'interactive', label: '⚡ Interactive Simulator' },
            { id: 'cli', label: 'CLI (npx)' },
            { id: 'action', label: 'GitHub Action' },
            { id: 'agent', label: 'AI Agent Hook' },
          ].map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: `1px solid ${active ? '#34d39955' : 'transparent'}`,
                  background: active ? '#10b98118' : 'transparent',
                  color: active ? '#34d399' : '#888d96',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s ease'
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Interactive Mode Content */}
      {tab === 'interactive' && (
        <div style={{ padding: '20px 22px' }}>
          {/* Preset scenario chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {PRESET_SCENARIOS.map((scenario) => (
              <button
                key={scenario.label}
                onClick={() => {
                  setInputText(scenario.text)
                  setStep('idle')
                  setDetectedSecret(null)
                }}
                style={{
                  background: inputText === scenario.text ? 'rgba(52, 211, 153, 0.12)' : '#181a1d',
                  border: `1px solid ${inputText === scenario.text ? 'rgba(52, 211, 153, 0.4)' : '#27282d'}`,
                  color: inputText === scenario.text ? '#34d399' : '#8e939d',
                  borderRadius: 6,
                  padding: '5px 11px',
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {scenario.label}
              </button>
            ))}
          </div>

          {/* Input container */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                if (step !== 'idle') setStep('idle')
              }}
              placeholder="Type an architectural decision or commit note..."
              style={{
                flex: 1,
                background: '#0c0d0e',
                border: '1px solid #27282d',
                borderRadius: 7,
                padding: '9px 13px',
                color: '#f4f4f5',
                fontSize: 12,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => (e.target.style.borderColor = '#34d399')}
              onBlur={(e) => (e.target.style.borderColor = '#27282d')}
            />
            <button
              onClick={handleRun}
              disabled={step === 'capturing' || step === 'auditing'}
              style={{
                background: '#34d399',
                color: '#052e22',
                border: 'none',
                borderRadius: 7,
                padding: '0 18px',
                fontSize: 12,
                fontWeight: 600,
                cursor: step === 'capturing' || step === 'auditing' ? 'not-allowed' : 'pointer',
                opacity: step === 'capturing' || step === 'auditing' ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s, transform 0.1s'
              }}
            >
              {step === 'capturing' || step === 'auditing' ? 'Auditing...' : 'Run Baton Audit →'}
            </button>
          </div>

          {/* Live Pipeline Stages or Idle Help */}
          {step === 'idle' ? (
            <div
              style={{
                background: '#0c0e10',
                border: '1px dashed #23252a',
                borderRadius: 7,
                padding: '14px 16px',
                fontSize: 11,
                color: '#717680',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>Click a preset scenario above or edit the prompt, then click &apos;Run Baton Audit&apos;</span>
              <span style={{ color: '#34d399' }}>Ready</span>
            </div>
          ) : (
            <div
              style={{
                background: '#0c0d0e',
                border: '1px solid #222429',
                borderRadius: 8,
                padding: '14px 16px',
                fontSize: 11,
                fontFamily: 'monospace'
              }}
            >
              {/* Step 1: Capture */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color: '#34d399' }}>✓</span>
                <span style={{ color: '#747881' }}>[01 / CAPTURE]</span>
                <span style={{ color: '#d1d5db' }}>Ingested decision trace & git HEAD state.</span>
              </div>

              {/* Step 2: Shannon Audit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {step === 'capturing' ? (
                  <span style={{ color: '#e8b86d' }}>⋯</span>
                ) : (
                  <span style={{ color: detectedSecret ? '#fbbf24' : '#34d399' }}>
                    {detectedSecret ? '🛡️' : '✓'}
                  </span>
                )}
                <span style={{ color: '#747881' }}>[02 / SHANNON AUDIT]</span>
                {step === 'capturing' ? (
                  <span style={{ color: '#8b909a' }}>Evaluating entropy on token payload...</span>
                ) : detectedSecret ? (
                  <span style={{ color: '#fbbf24' }}>
                    High-entropy secret ({detectedSecret.slice(0, 10)}...) quarantined client-side.
                  </span>
                ) : (
                  <span style={{ color: '#34d399' }}>0 raw credentials detected. Clean payload.</span>
                )}
              </div>

              {/* Step 3: Verified Card Output */}
              {step === 'verified' && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '12px 14px',
                    background: '#131518',
                    border: '1px solid #284435',
                    borderRadius: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      ✓ HANDOVER RECORD #BATON-884 GENERATED
                    </span>
                    <span
                      style={{
                        background: '#10b98118',
                        color: '#34d399',
                        border: '1px solid #284435',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 9
                      }}
                    >
                      AST-GROUNDED ON HEAD
                    </span>
                  </div>

                  {/* Sanitized rationale */}
                  <div
                    style={{
                      background: '#0c0d0e',
                      padding: '8px 10px',
                      borderRadius: 5,
                      color: '#e5e7eb',
                      lineHeight: 1.5,
                      marginBottom: 10
                    }}
                  >
                    {detectedSecret ? (
                      <span>
                        {inputText.split(detectedSecret)[0]}
                        <span
                          style={{
                            background: '#fbbf241f',
                            color: '#fbbf24',
                            border: '1px solid #f59e0b55',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 600,
                            margin: '0 3px'
                          }}
                        >
                          [REDACTED_SECRET_ENTROPY_5.42]
                        </span>
                        {inputText.split(detectedSecret)[1]}
                      </span>
                    ) : (
                      <span>{inputText}</span>
                    )}
                  </div>

                  {/* Metadata tags */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 14,
                      color: '#717680',
                      fontSize: 10,
                      flexWrap: 'wrap',
                      marginBottom: 10
                    }}
                  >
                    <span>Clearance: <strong style={{ color: '#c2c6cf' }}>Backend</strong></span>
                    <span>Audit: <strong style={{ color: '#34d399' }}>0 Leaks</strong></span>
                    <span>Citations: <strong style={{ color: '#34d399' }}>PR #42 (merged)</strong></span>
                    <span>Certainty: <strong style={{ color: '#c2c6cf' }}>Verified</strong></span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={handleCopyHandover}
                      style={{
                        background: '#22252a',
                        border: '1px solid #32363e',
                        color: '#d1d5db',
                        padding: '4px 10px',
                        borderRadius: 5,
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 500
                      }}
                    >
                      {copiedHandover ? '✓ Copied Handover JSON' : 'Copy Handover JSON'}
                    </button>
                    <button
                      onClick={handleReset}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#717680',
                        cursor: 'pointer',
                        fontSize: 10,
                        textDecoration: 'underline'
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Terminal Snippet Mode (CLI, Action, Agent) */}
      {tab !== 'interactive' && (
        <div>
          {/* Command bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
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
              onClick={() => handleCopyCommand(activeSnippet.command)}
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
              <Icon name={copiedCommand ? 'check' : 'copy'} size={12} />
              {copiedCommand ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Output Area */}
          <div
            style={{
              padding: '18px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              lineHeight: 1.85,
              background: '#0c0e10',
              minHeight: 170
            }}
          >
            {activeSnippet.output.map((line, idx) => (
              <div key={idx} style={{ color: line.color }}>
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TOCSidebar({ activeId, onNavigate }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 135,
        zIndex: 50,
        userSelect: 'none',
      }}
    >
      {/* Minimal Header */}
      <div
        style={{
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid #1e2025'
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#4b5563',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'monospace'
          }}
        >
          On this page
        </span>
      </div>

      {/* Clean minimal links with absolute indicator rail */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV_ITEMS.map(({ id, label }, index) => {
          const active = activeId === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                position: 'relative',
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '5px 0 5px 14px',
                cursor: 'pointer',
                color: active ? '#34d399' : '#6b7280',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                transition: 'color 0.15s ease',
                whiteSpace: 'nowrap',
                opacity: 0,
                animation: `tocItemEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.35 + index * 0.08}s forwards`,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e5e7eb' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6b7280' }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  marginTop: -1,
                  width: 8,
                  height: 2,
                  borderRadius: 2,
                  background: '#34d399',
                  boxShadow: '0 0 8px rgba(52, 211, 153, 0.8)',
                  opacity: active ? 1 : 0,
                  transform: active ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export function UsagePage() {
  const { navigate } = useRouter()
  const [activeId, setActiveId] = useState('overview')

  const heroRef = useRef(null)
  const featuresRef = useRef(null)
  const workflowRef = useRef(null)
  const architectureRef = useRef(null)
  const docsRef = useRef(null)

  const scrollToSection = (id) => {
    setActiveId(id)

    if (id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const refMap = {
      features: featuresRef,
      workflow: workflowRef,
      architecture: architectureRef,
      docs: docsRef
    }

    const targetRef = refMap[id]
    if (targetRef?.current) {
      if (id === 'docs') {
        const details = targetRef.current.querySelector('details')
        if (details) details.open = true
      }
      const rect = targetRef.current.getBoundingClientRect()
      const targetY = rect.top + window.scrollY - 120
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' })
    }
  }

  // Accurate scroll tracking
  useEffect(() => {
    const onScroll = () => {
      const isAtBottom =
        window.innerHeight + window.scrollY >= (document.documentElement.scrollHeight - 120)
      if (isAtBottom) {
        setActiveId('docs')
        return
      }

      const scrollY = window.scrollY + 160
      const sections = [
        { id: 'overview',     top: 0 },
        { id: 'features',     top: featuresRef.current ? featuresRef.current.getBoundingClientRect().top + window.scrollY : Infinity },
        { id: 'workflow',     top: workflowRef.current ? workflowRef.current.getBoundingClientRect().top + window.scrollY : Infinity },
        { id: 'architecture', top: architectureRef.current ? architectureRef.current.getBoundingClientRect().top + window.scrollY : Infinity },
        { id: 'docs',         top: docsRef.current ? docsRef.current.getBoundingClientRect().top + window.scrollY : Infinity },
      ].filter(s => s.top !== Infinity).sort((a, b) => a.top - b.top)

      let current = 'overview'
      for (const { id, top } of sections) {
        if (scrollY >= top) current = id
      }
      setActiveId(current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="usage-page-wrapper"
      style={{
        position: 'relative',
        background: C.bg,
        color: C.text,
        minHeight: '100vh',
        overflowX: 'hidden'
      }}
    >
      <style>{`
        @keyframes morphFloorStage {
          0% {
            border-radius: 46% 54% 60% 40% / 40% 50% 50% 60%;
            transform: translate(0px, 0px) scale(1, 0.96);
            opacity: 0.65;
          }
          50% {
            border-radius: 58% 42% 48% 52% / 55% 42% 58% 45%;
            transform: translate(30px, -15px) scale(1.06, 1.04);
            opacity: 0.85;
          }
          100% {
            border-radius: 46% 54% 60% 40% / 40% 50% 50% 60%;
            transform: translate(0px, 0px) scale(1, 0.96);
            opacity: 0.65;
          }
        }

        @keyframes morphLeftRise {
          0% {
            border-radius: 55% 45% 40% 60% / 50% 45% 55% 50%;
            transform: translate(0px, 0px) rotate(-6deg) scale(0.98);
            opacity: 0.55;
          }
          50% {
            border-radius: 40% 60% 65% 35% / 45% 55% 45% 55%;
            transform: translate(20px, -25px) rotate(4deg) scale(1.06, 1.12);
            opacity: 0.8;
          }
          100% {
            border-radius: 55% 45% 40% 60% / 50% 45% 55% 50%;
            transform: translate(0px, 0px) rotate(-6deg) scale(0.98);
            opacity: 0.55;
          }
        }

        @keyframes radarPing {
          0% { transform: scale(0.9); opacity: 0.45; }
          70% { transform: scale(2.3); opacity: 0; }
          100% { transform: scale(2.3); opacity: 0; }
        }

        /* Hero Entrance Keyframes (Word-by-word staggered reveal) */
        @keyframes heroWordSlideUp {
          0% {
            opacity: 0;
            transform: translateY(22px);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }

        @keyframes heroFadeUp {
          0% {
            opacity: 0;
            transform: translateY(18px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes tocItemEnter {
          0% {
            opacity: 0;
            transform: translateX(14px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .hero-word {
          display: inline-block;
          opacity: 0;
          animation: heroWordSlideUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity, filter;
        }

        .hero-badge-enter {
          opacity: 0;
          animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.05s forwards;
        }

        .hero-buttons-enter {
          opacity: 0;
          animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.72s forwards;
        }

        .hero-subtext-enter {
          opacity: 0;
          animation: heroFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.85s forwards;
        }

        /* Atmospheric Ambient Floor Stage (Persistent fixed viewport ambient glow, soft & subtle) */
        .ambient-grounded-stage {
          position: fixed;
          left: -12vw;
          bottom: -10vh;
          width: 65vw;
          max-width: 900px;
          height: 520px;
          background: radial-gradient(
            ellipse at 35% 85%,
            rgba(52, 211, 153, 0.14) 0%,
            rgba(16, 185, 129, 0.08) 38%,
            rgba(5, 46, 34, 0.03) 65%,
            transparent 80%
          );
          filter: blur(140px);
          pointer-events: none;
          z-index: 0;
          animation: morphFloorStage 18s ease-in-out infinite;
          transform-origin: 30% 90%;
          mix-blend-mode: screen;
          opacity: 0.75;
        }

        .ambient-left-rise {
          position: fixed;
          left: -8vw;
          bottom: -5vh;
          width: 48vw;
          max-width: 680px;
          height: 420px;
          background: radial-gradient(
            ellipse at 25% 70%,
            rgba(110, 231, 183, 0.10) 0%,
            rgba(52, 211, 153, 0.05) 42%,
            transparent 75%
          );
          filter: blur(120px);
          pointer-events: none;
          z-index: 0;
          animation: morphLeftRise 14s ease-in-out infinite;
          mix-blend-mode: screen;
          opacity: 0.7;
        }

        /* Top-Right Ambient Counter-Glow (Persistent fixed viewport glow) */
        .ambient-counter-glow {
          position: fixed;
          right: -6vw;
          top: -4vh;
          width: 42vw;
          max-width: 580px;
          height: 420px;
          background: radial-gradient(
            ellipse at 70% 30%,
            rgba(52, 211, 153, 0.12) 0%,
            rgba(16, 185, 129, 0.06) 40%,
            transparent 72%
          );
          filter: blur(130px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.75;
          mix-blend-mode: screen;
        }

        /* Minimal radar indicator for Hackathon badge */
        .radar-beacon {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 8px;
          height: 8px;
          margin-right: 6px;
        }

        .radar-beacon::before {
          content: '';
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }

        .radar-beacon::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(52, 211, 153, 0.6);
          animation: radarPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        /* Hide TOC on smaller screens */
        @media (max-width: 1220px) {
          .baton-toc {
            display: none !important;
          }
        }
      `}</style>

      {/* Atmospheric lighting layers */}
      <div className="ambient-grounded-stage" />
      <div className="ambient-left-rise" />
      <div className="ambient-counter-glow" />

      {/* Top Welcome Alert Banner */}
      <div
        style={{
          background: 'linear-gradient(90deg, #0d1e17, #10291f, #0d1e17)',
          borderBottom: '1px solid #1f4f39',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontSize: 12,
          color: '#e2f7ed',
          zIndex: 60,
          position: 'sticky',
          top: 0
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
          <strong>Welcome to Baton!</strong> Explore product usage below or continue directly to your workspace.
        </span>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: C.green,
            color: '#052e22',
            border: 0,
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span>View Dashboard</span>
          <span>→</span>
        </button>
      </div>

      {/* Sticky Top Header (Clean: Logo on left, Buttons on right; features/workflow removed from header) */}
      <header
        className="bt-nav"
        style={{
          borderBottom: `1px solid ${C.line}`,
          background: '#0c0d0ee6',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(18px)'
        }}
      >
        <div
          className="bt-shell"
          style={{
            height: 76,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Brand />
            <span
              className="bt-round"
              style={{
                fontSize: 9,
                color: '#93979f',
                padding: '5px 7px',
                border: '1px solid #303238',
                borderRadius: 4,
                letterSpacing: 0.3
              }}
            >
              Hackathon Build · Round 2
            </span>
          </div>

          <div style={{ display: 'flex', gap: 17, alignItems: 'center' }}>
            <button
              className="bt-text bt-signin"
              onClick={() => navigate('/auth')}
              style={{
                fontSize: 12,
                fontWeight: 500,
                border: 0,
                background: 'none',
                color: C.text,
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <Button
              primary
              onClick={() => navigate('/dashboard')}
              style={{ padding: '9px 15px', fontSize: 12 }}
            >
              View Dashboard
              <Icon size={13} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="bt-shell">
          {/* Hero Section */}
          <section className="bt-hero" ref={heroRef}>
            <div
              style={{
                maxWidth: 780,
                margin: '0 auto',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <span
                className="hero-badge-enter"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#b3b9b5',
                  border: '1px solid #284435',
                  background: '#10b98108',
                  borderRadius: 30,
                  padding: '6px 14px',
                  fontWeight: 500,
                  marginBottom: 10
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: C.green,
                    borderRadius: 10,
                    boxShadow: '0 0 8px #34d39966',
                    display: 'inline-block'
                  }}
                />
                Built for the next engineer.
              </span>

              <h1 className="bt-title" style={{ marginBottom: 34 }}>
                <span className="hero-word" style={{ animationDelay: '0.12s' }}>Pass</span>{' '}
                <span className="hero-word" style={{ animationDelay: '0.20s' }}>the</span>{' '}
                <span className="hero-word" style={{ animationDelay: '0.28s' }}>knowledge,</span>{' '}
                <span className="hero-word" style={{ color: C.green, animationDelay: '0.40s' }}>not</span>{' '}
                <span className="hero-word" style={{ color: C.green, animationDelay: '0.48s' }}>just</span>{' '}
                <span className="hero-word" style={{ color: C.green, animationDelay: '0.56s' }}>the</span>{' '}
                <span className="hero-word" style={{ color: C.green, animationDelay: '0.64s' }}>code.</span>
              </h1>

              <div
                className="hero-buttons-enter"
                style={{
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                  justifyContent: 'center'
                }}
              >
                <Button
                  primary
                  onClick={() => navigate('/dashboard')}
                  style={{ padding: '14px 26px', fontSize: 14 }}
                >
                  View Dashboard
                  <Icon size={16} />
                </Button>
                <Button
                  onClick={() => scrollToSection('workflow')}
                  style={{ padding: '14px 24px', fontSize: 14 }}
                >
                  View Workflow
                  <Icon size={16} />
                </Button>
              </div>

              <p
                className="hero-subtext-enter"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#747982',
                  marginTop: 26
                }}
              >
                <Icon name="shield" size={12} />
                Project-scoped. Secret-redacted. Always cited.
              </p>
            </div>
          </section>

          {/* Context Line / Trust Bar with generous breathing room */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 20,
              padding: '28px 0',
              marginTop: 65,
              marginBottom: 80,
              borderTop: `1px solid ${C.line}`,
              borderBottom: `1px solid ${C.line}`,
              fontSize: 10,
              color: '#6e727b',
              flexWrap: 'wrap',
              letterSpacing: 0.5
            }}
          >
            <span>CONTEXT IN. CONFIDENCE OUT.</span>
            <span style={{ color: '#a2a6ae' }}>
              AI coding agents <span style={{ margin: '0 14px', color: '#373b41' }}>/</span> Git history <span style={{ margin: '0 14px', color: '#373b41' }}>/</span> Human decisions
            </span>
          </div>

          <SectionDivider />

          {/* Features Section */}
          <section
            ref={featuresRef}
            style={{ padding: '80px 0 120px', scrollMarginTop: 110 }}
          >
            <div
              style={{
                color: C.green,
                fontSize: 10,
                letterSpacing: 1.7,
                fontFamily: 'monospace',
                marginBottom: 12,
                fontWeight: 600
              }}
            >
              BUILT FOR CONTINUITY
            </div>
            <h2
              style={{
                fontSize: 31,
                fontWeight: 500,
                letterSpacing: -1.2,
                margin: '0 0 10px'
              }}
            >
              A handover. Not a guessing game.
            </h2>
            <p
              style={{
                fontSize: 13,
                color: C.muted,
                margin: '0 0 30px',
                lineHeight: 1.8
              }}
            >
              Everything your next engineer needs. Nothing they shouldn’t see.
            </p>

            <div
              className="bt-grid"
              style={{
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                overflow: 'hidden'
              }}
            >
              {[
                {
                  icon: 'git',
                  title: 'Every claim has a source.',
                  body: 'Trace decisions back to the pull request, commit, or conversation that made them.',
                  note: 'Evidence over assumptions'
                },
                {
                  icon: 'lock',
                  title: 'Context without the risk.',
                  body: 'Secrets are redacted before handover. Role-based clearance keeps sensitive context scoped.',
                  note: 'Private by design'
                },
                {
                  icon: 'shield',
                  title: 'Know what you can trust.',
                  body: 'Verified, inferred, and conflicting claims stay distinct. Uncertainty is visible, not buried.',
                  note: 'Confidence, made explicit'
                }
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="bt-card"
                  style={{
                    padding: 26,
                    background: '#111315',
                    borderRight: i < 2 ? `1px solid ${C.line}` : undefined
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      color: C.green,
                      background: '#10b9810a',
                      padding: 9,
                      border: '1px solid #294136',
                      borderRadius: 7
                    }}
                  >
                    <Icon name={f.icon} size={18} />
                  </span>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      margin: '22px 0 10px'
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.8,
                      color: C.muted,
                      margin: '0 0 25px'
                    }}
                  >
                    {f.body}
                  </p>
                  <span
                    style={{
                      fontSize: 9,
                      color: '#6f7975',
                      fontFamily: 'monospace'
                    }}
                  >
                    {f.note}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* Developer Workflow & Interactive Simulator Section */}
          <section
            ref={workflowRef}
            style={{ padding: '80px 0 120px', scrollMarginTop: 110 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div
                style={{
                  color: C.green,
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
                  color: C.muted,
                  margin: '0 auto',
                  maxWidth: 540,
                  lineHeight: 1.8
                }}
              >
                No heavy enterprise dashboards. Run the live audit simulator below, trigger Baton in CI/CD, or invoke it directly from your terminal and AI agents.
              </p>
            </div>

            {/* Unified Developer Workflow Console */}
            <UnifiedWorkflowConsole />
          </section>

          <SectionDivider />

          {/* Architecture / 3-Pillar Technical Pipeline Grid */}
          <section
            ref={architectureRef}
            style={{ padding: '80px 0 120px', scrollMarginTop: 110 }}
          >
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  color: C.green,
                  fontSize: 10,
                  letterSpacing: 1.7,
                  fontFamily: 'monospace',
                  marginBottom: 10,
                  fontWeight: 600
                }}
              >
                CORE ARCHITECTURE
              </div>
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: -1,
                  margin: '0 0 10px',
                  color: '#f4f4f5'
                }}
              >
                From scattered context to shared clarity.
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: C.muted,
                  margin: 0,
                  lineHeight: 1.8
                }}
              >
                How Baton operates under the hood across agent execution, secret sanitization, and verified handover packaging.
              </p>
            </div>

            {/* 3-Pillar Technical Engine Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                marginBottom: 32
              }}
            >
              {/* Pillar 1 */}
              <div
                className="bt-card"
                style={{
                  padding: 24,
                  background: '#111315',
                  border: `1px solid ${C.line}`,
                  borderRadius: 9
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.green, letterSpacing: 1.2 }}>01 / CAPTURE</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#6ee7b7', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid #284435', padding: '2px 7px', borderRadius: 10 }}>ACTIVE DAEMON</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 10px', color: '#f4f4f5' }}>Local MCP Daemon</h3>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: C.muted, margin: '0 0 16px' }}>
                  Runs quietly as a lightweight local MCP server. Continuously intercepts architectural intent, prompt rationale, and uncommitted git decisions from Claude, Cursor, and terminal sessions.
                </p>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6f7975', borderTop: '1px solid #1e2025', paddingTop: 12 }}>
                  Protocol: JSON-RPC over stdio · Zero cloud dependency
                </div>
              </div>

              {/* Pillar 2 */}
              <div
                className="bt-card"
                style={{
                  padding: 24,
                  background: '#111315',
                  border: `1px solid ${C.line}`,
                  borderRadius: 9
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.green, letterSpacing: 1.2 }}>02 / SANITIZE</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '2px 7px', borderRadius: 10 }}>SHANNON FILTER</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 10px', color: '#f4f4f5' }}>Shannon Entropy Engine</h3>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: C.muted, margin: '0 0 16px' }}>
                  Scans text payloads for high-entropy strings (&gt;4.5 bits/char). Strips Stripe keys, JWTs, AWS credentials, and session cookies before documentation ever leaves localhost.
                </p>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6f7975', borderTop: '1px solid #1e2025', paddingTop: 12 }}>
                  Entropy threshold: 4.5 bits · Client-side regex & AST
                </div>
              </div>

              {/* Pillar 3 */}
              <div
                className="bt-card"
                style={{
                  padding: 24,
                  background: '#111315',
                  border: `1px solid ${C.line}`,
                  borderRadius: 9
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.green, letterSpacing: 1.2 }}>03 / DELIVER</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '2px 7px', borderRadius: 10 }}>SCOPED CLEARANCE</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 10px', color: '#f4f4f5' }}>AST-Grounded Handover</h3>
                <p style={{ fontSize: 12, lineHeight: 1.7, color: C.muted, margin: '0 0 16px' }}>
                  Synthesizes validated citations anchored to exact git PRs and commits. Distinguishes verified facts from unmerged assumptions, filtered strictly by role clearance.
                </p>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6f7975', borderTop: '1px solid #1e2025', paddingTop: 12 }}>
                  Output: Role-based Markdown & JSON artifacts
                </div>
              </div>
            </div>
          </section>

          <SectionDivider />

          {/* Comparison */}
          <div style={{ padding: '80px 0 120px' }}>
            <Comparison />
          </div>

          <SectionDivider />

          {/* CTA Banner */}
          <div style={{ padding: '70px 0 110px' }}>
            <CtaBanner
              onGetStarted={() => navigate('/dashboard')}
              actionLabel="View Dashboard"
            />
          </div>

          <SectionDivider />

          {/* Developer Notes / Docs Section */}
          <section
            ref={docsRef}
            style={{ padding: '60px 0 120px', scrollMarginTop: 110 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  color: C.green,
                  fontSize: 10,
                  letterSpacing: 1.7,
                  fontFamily: 'monospace',
                  marginBottom: 10,
                  fontWeight: 600
                }}
              >
                DEVELOPER NOTES
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
                Behind the code.
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: C.muted,
                  margin: '0 auto',
                  maxWidth: 540,
                  lineHeight: 1.8
                }}
              >
                Engineering rationale and candid builder dialogue directly from the developers behind Baton.
              </p>
            </div>

            {/* Option C Dialogue Table Card with Stickers */}
            <DeveloperNotesCard />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.line}` }}>
        <div
          className="bt-shell bt-bottom"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 26,
            paddingBottom: 26
          }}
        >
          <Brand size={20} />
          <span style={{ fontSize: 11, color: '#747881' }}>
            Pass the knowledge. Keep the momentum.
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#555b64',
              fontFamily: 'monospace'
            }}
          >
            © 2026 BATON · Hackathon Build
          </span>
        </div>
      </footer>

      {/* Right sidebar TOC */}
      <div className="baton-toc">
        <TOCSidebar activeId={activeId} onNavigate={scrollToSection} />
      </div>
    </div>
  )
}

export default UsagePage
