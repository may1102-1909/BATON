import React, { useState, useRef, useEffect } from 'react'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { Button } from './Button'
import { Preview } from './Preview'
import { Auth } from './Auth'
import { Scene } from './Scene'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399',
  greenDark: '#10b981'
}

export function BatonLandingPage({ initialTab = '3d-paper' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [variant, setVariant] = useState('original')
  const [mode, setMode] = useState('login')
  const [expanded, setExpanded] = useState(0)

  const heroRef = useRef(null)
  const dashboardRef = useRef(null)
  const featuresRef = useRef(null)
  const architectureRef = useRef(null)
  const docsRef = useRef(null)

  // Listen to hash changes for direct deep linking e.g. #/dashboard, #/review, #/auth
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.replace(/^#\/?/, '')
      if (hash === 'auth' || hash === 'login' || hash === 'signup') {
        setMode(hash === 'signup' ? 'signup' : 'login')
        setActiveTab('auth')
      } else if (hash === 'dashboard' || hash === 'review' || hash === 'demo') {
        setActiveTab('dashboard')
        setTimeout(() => {
          dashboardRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else if (hash === 'paper' || hash === '3d' || hash === '') {
        setActiveTab('3d-paper')
      }
    }

    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  function auth(m = 'signup') {
    setMode(m)
    setActiveTab('auth')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scrollToSection(ref, tabName) {
    if (activeTab === 'auth') {
      setActiveTab('3d-paper')
    }
    if (tabName) setActiveTab(tabName)
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function handleCardAction(action) {
    if (action === 'dashboard' || action === 'explore') {
      scrollToSection(dashboardRef, 'dashboard')
    } else if (action === 'review' || action === 'inspect') {
      scrollToSection(dashboardRef, 'dashboard')
      setExpanded(0)
    }
  }

  if (activeTab === 'auth') {
    return <Auth mode={mode} setMode={setMode} back={() => setActiveTab('3d-paper')} onAuthSuccess={() => { window.location.href = '/usage' }} />
  }

  return (
    <div
      className="baton-app relative w-full min-h-screen text-[#f4f4f5] selection:bg-[#34d399]/30 selection:text-white"
      style={{ background: C.bg }}
    >
      {/* Sticky Navigation Header */}
      <header
        className="bt-nav sticky top-0 z-50 border-b border-[#27282d] bg-[#0c0d0ee6] backdrop-blur-md"
      >
        <div className="bt-shell h-[76px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <a href="#/paper" onClick={() => scrollToSection(heroRef, '3d-paper')} className="cursor-pointer no-underline">
              <Brand size={24} />
            </a>
            <span
              className="bt-round hidden sm:inline-flex items-center gap-1.5 text-[9px] text-[#93979f] px-2 py-1 border border-[#303238] rounded bg-[#131417] tracking-wider uppercase font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              Round 2 · Mumbai_Wale
            </span>
          </div>

          <nav className="bt-navlinks hidden md:flex items-center gap-6" aria-label="Main navigation">
            {[
              ['3D Paper', heroRef, '3d-paper'],
              ['Dashboard', dashboardRef, 'dashboard'],
              ['Features', featuresRef, null],
              ['Architecture', architectureRef, null],
              ['Docs', docsRef, null],
            ].map(([label, ref, tab]) => (
              <button
                key={label}
                className={`text-[12px] font-medium transition-colors hover:text-[#34d399] border-0 bg-transparent cursor-pointer ${
                  activeTab === tab ? 'text-[#34d399]' : 'text-[#999ba5]'
                }`}
                onClick={() => scrollToSection(ref, tab)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button
              className="bt-text bt-signin text-[12px] font-medium text-[#f4f4f5] border-0 bg-transparent cursor-pointer hover:text-[#34d399]"
              onClick={() => auth('login')}
            >
              Sign In
            </button>
            <Button
              primary
              onClick={() => auth('signup')}
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              Get Started
              <Icon size={13} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative w-full">
        {/* =========================================================================
            HERO: ThreeUI 3D Paper Experience for Baton
            ========================================================================= */}
        <section
          ref={heroRef}
          className="relative w-full overflow-hidden bg-[#08080a] border-b border-[#202227]"
          style={{ height: 'calc(100vh - 76px)', minHeight: '680px', maxHeight: '960px' }}
        >
          {/* 3D Paper WebGL Canvas */}
          <div className="absolute inset-0 w-full h-full">
            <Scene variant={variant} onAction={handleCardAction} />
          </div>

          {/* Floating Top Pill / Hackathon Badge */}
          <div className="absolute top-5 left-0 right-0 z-20 pointer-events-none flex justify-center px-4">
            <div className="pointer-events-auto inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-[#34d399]/30 bg-[#0c0e10]/85 backdrop-blur-md shadow-lg shadow-black/50">
              <span className="w-2 h-2 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
              <span className="text-[11px] font-medium tracking-wide text-[#cbd5e1]">
                CodersInPune Hackathon 2026 · Team <span className="text-[#34d399] font-semibold">MUMBAI_WALE</span>
              </span>
            </div>
          </div>

          {/* Floating Bottom Action HUD */}
          <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-3 px-4 pointer-events-none">
            {/* Primary & Secondary CTA Buttons */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => scrollToSection(dashboardRef, 'dashboard')}
                className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-[#34d399] text-[#052e22] text-[13px] font-semibold shadow-[0_0_24px_rgba(52,211,153,0.35)] transition-all hover:bg-[#46e2a9] hover:shadow-[0_0_32px_rgba(52,211,153,0.5)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer border-0"
              >
                <span>Explore Dashboard</span>
                <span className="transition-transform group-hover:translate-x-1">
                  <Icon size={14} />
                </span>
              </button>

              <button
                onClick={() => {
                  scrollToSection(dashboardRef, 'dashboard')
                  setExpanded(0)
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#14161a]/90 border border-[#30333a] text-[#e2e8f0] text-[13px] font-medium backdrop-blur-md transition-all hover:bg-[#1c1f24] hover:border-[#34d399]/50 hover:text-white hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg"
              >
                <Icon name="code" size={14} style={{ color: '#34d399' }} />
                <span>View Handover Review</span>
              </button>

              {/* Variant Switcher Pill */}
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111317]/90 border border-[#2b2d34] backdrop-blur-md text-[11px] font-mono">
                <span className="text-[#64748b] px-2 select-none">3D Theme:</span>
                {[
                  ['original', 'Baton Official'],
                  ['certificate', 'Certificate'],
                  ['japanese', '日本語'],
                  ['site-of-the-year', 'SOTY'],
                  ['nocturne', 'Nocturne']
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer border-0 ${
                      variant === v
                        ? 'bg-[#34d399] text-[#052e22] font-semibold shadow-sm'
                        : 'bg-transparent text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interaction Hint */}
            <p className="text-[10px] tracking-widest uppercase text-[#94a3b8]/60 font-mono select-none m-0">
              Drag sheet to rotate · Hover to cast specular light
            </p>
          </div>
        </section>

        {/* =========================================================================
            LIVE DASHBOARD & HANDOVER PREVIEW
            ========================================================================= */}
        <section
          ref={dashboardRef}
          className="relative py-20 border-b border-[#27282d] bg-[#0c0d0e]"
        >
          <div className="bt-shell">
            {/* Header info */}
            <div className="mb-12 max-w-2xl">
              <span className="inline-flex items-center gap-2 text-[10px] font-mono font-medium text-[#34d399] tracking-wider uppercase px-2.5 py-1 rounded border border-[#234e3b] bg-[#10b981]/10 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                Interactive Handover Inspection
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f4f4f5] m-0 mb-3 font-display">
                Pass the knowledge, not just the code.
              </h2>
              <p className="text-[14px] leading-relaxed text-[#999ba5] m-0">
                Real-time developer reasoning capture, bus-factor risk detection, and automated knowledge handover.
                Inspect verified decisions, unmerged work, and quarantined secrets below.
              </p>
            </div>

            {/* Interactive Handover Code Window */}
            <div className="w-full max-w-4xl mx-auto">
              <Preview expanded={expanded} setExpanded={setExpanded} />
            </div>

            {/* Quick Action Bar under Preview */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-[#27282d] bg-[#131417]">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34d399]"></span>
                </span>
                <span className="text-[12px] text-[#cbd5e1] font-mono">
                  Engine connected: MCP context daemon v2.4 (Active sync)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => auth('signup')}
                  style={{ padding: '8px 14px', fontSize: 11 }}
                >
                  Generate New Handover
                  <Icon size={12} />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FEATURES SECTION: 3 CORE CAPABILITIES
            ========================================================================= */}
        <section
          ref={featuresRef}
          className="py-20 border-b border-[#27282d] bg-[#0f1012]"
        >
          <div className="bt-shell">
            <div className="text-center max-w-xl mx-auto mb-16">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#34d399]">
                CORE ARCHITECTURE
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-3 text-[#f4f4f5]">
                Built for High-Velocity Engineering Teams
              </h2>
              <p className="text-[13px] text-[#999ba5] leading-relaxed">
                Traditional wikis decay within weeks. Baton generates verifiable, grounded handovers
                straight from agent conversation logs, git commits, and code changes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Real-Time Reasoning Capture',
                  body: 'Indexes developer thought processes and AI agent tool calls as code is written, preserving context before it is lost.',
                  tag: 'MCP & Agent Daemon',
                  icon: 'git'
                },
                {
                  title: 'Bus-Factor Risk Detection',
                  body: 'Monitors single-maintainer modules, stale branches, and knowledge concentration to alert teams before turnover causes outages.',
                  tag: 'Automated Inferences',
                  icon: 'shield'
                },
                {
                  title: 'Zero-Leak Role Delivery',
                  body: 'Automatically redacts credentials, environment keys, and internal secrets, producing tailored briefs for incoming engineers.',
                  tag: 'Cryptographic Redaction',
                  icon: 'lock'
                }
              ].map((f) => (
                <div
                  key={f.title}
                  className="bt-card p-7 rounded-xl border border-[#27282d] bg-[#14161a] flex flex-col justify-between transition-all hover:border-[#34d399]/40 hover:bg-[#181a1f]"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#34d399]/10 border border-[#34d399]/30 flex items-center justify-center text-[#34d399] mb-5">
                      <Icon name={f.icon} size={18} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-[#f4f4f5]">
                      {f.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-[#999ba5] mb-6">
                      {f.body}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#34d399] tracking-wider uppercase">
                    {f.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            ARCHITECTURE PIPELINE
            ========================================================================= */}
        <section
          ref={architectureRef}
          className="py-20 border-b border-[#27282d] bg-[#0c0d0e]"
        >
          <div className="bt-shell">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#34d399]">
                  PIPELINE FLOW
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold mt-2 text-[#f4f4f5]">
                  From scattered context to shared clarity.
                </h2>
              </div>
              <span className="text-[12px] text-[#999ba5]">
                End-to-end autonomous knowledge transfer
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 rounded-xl border border-[#27282d] bg-[#111316]">
              {[
                {
                  step: '01',
                  title: 'Capture agent & git context',
                  desc: 'Listens to Cursor / Claude Code IDE actions, commits, and PR descriptions.'
                },
                {
                  step: '02',
                  title: 'Cite, redact & check claims',
                  desc: 'Verifies code decisions against AST changes, redacting API keys and passwords.'
                },
                {
                  step: '03',
                  title: 'Deliver role-based handover',
                  desc: 'Packages high-fidelity context into structured 3D cards & inspectable reports.'
                }
              ].map((s, idx) => (
                <div key={s.step} className="p-4 rounded-lg bg-[#16181d] border border-[#22242a]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] font-mono font-bold text-[#34d399]">
                      {s.step}
                    </span>
                    <h4 className="text-[14px] font-semibold text-[#f4f4f5] m-0">
                      {s.title}
                    </h4>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[#999ba5] m-0">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            DOCS & DEVELOPER NOTES
            ========================================================================= */}
        <section
          ref={docsRef}
          className="py-16 bg-[#0a0b0d]"
        >
          <div className="bt-shell">
            <details className="border border-[#27282d] rounded-xl p-5 bg-[#121316] group">
              <summary className="text-[13px] font-medium text-[#cbd5e1] cursor-pointer flex items-center justify-between select-none list-none">
                <span className="flex items-center gap-2.5">
                  <Icon name="code" size={15} style={{ color: '#34d399' }} />
                  Developer notes · CodersInPune Hackathon 2026 Build Architecture
                </span>
                <span className="text-[11px] font-mono text-[#64748b] group-open:rotate-90 transition-transform">
                  ▶
                </span>
              </summary>
              <div className="mt-4 pt-4 border-t border-[#23252a] text-[12px] leading-relaxed text-[#999ba5] space-y-3">
                <p>
                  <strong>Team:</strong> MUMBAI_WALE · <strong>Track:</strong> Full Stack / AI Systems.
                </p>
                <p>
                  The interactive 3D Paper component renders a realistic translucent certificate plane in Three.js WebGL.
                  It utilizes a custom arc-length conserving vertex shader (GLSL) that curls dynamically based on mouse drag velocity and hover coordinates, with PMREM reflection mapping, dual frosted borders, procedural film grain, and specular highlights.
                </p>
                <p>
                  The handover citations demonstrate real-time reasoning extraction from code repositories.
                  Authentication and git sync adapters are modularized to connect Supabase Auth and GitHub MCP servers in production.
                </p>
              </div>
            </details>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27282d] bg-[#090a0b]">
        <div className="bt-shell py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Brand size={20} />
          <span className="text-[12px] text-[#747881]">
            Pass the knowledge. Keep the momentum.
          </span>
          <span className="text-[11px] text-[#555b64] font-mono">
            © 2026 BATON // TEAM MUMBAI_WALE // ROUND 2 BUILD
          </span>
        </div>
      </footer>
    </div>
  )
}

export default BatonLandingPage;

