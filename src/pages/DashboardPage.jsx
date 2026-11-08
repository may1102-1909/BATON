import React, { useState } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Preview } from '../components/Preview'
import { Link, useRouter } from '../router'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

export function DashboardPage() {
  const [expanded, setExpanded] = useState(0)
  const { navigate } = useRouter()

  return (
    <div
      className="relative w-full min-h-screen text-[#f4f4f5] selection:bg-[#34d399]/30 selection:text-white"
      style={{ background: C.bg }}
    >
      {/* Top Navigation */}
      <header className="bt-nav sticky top-0 z-50 border-b border-[#27282d] bg-[#0c0d0ee6] backdrop-blur-md">
        <div className="bt-shell h-[76px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="cursor-pointer no-underline flex items-center">
              <Brand size={24} />
            </Link>
            <span className="text-[#45484f]">/</span>
            <span className="text-[12px] font-mono font-medium text-[#34d399] tracking-wider uppercase">
              Dashboard
            </span>
          </div>

          <nav className="bt-navlinks hidden md:flex items-center gap-6" aria-label="Dashboard navigation">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              <Icon name="back" size={13} />
              3D Paper
            </Link>
            <Link
              to="/dashboard"
              className="text-[12px] font-semibold text-[#34d399] no-underline"
            >
              Overview
            </Link>
            <Link
              to="/review"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Handover Review
            </Link>
            <Link
              to="/tasks"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Tasks & Claims
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/auth?mode=login"
              className="bt-text bt-signin text-[12px] font-medium text-[#f4f4f5] hover:text-[#34d399] transition-colors no-underline"
            >
              Sign In
            </Link>
            <Link to="/auth?mode=signup" className="no-underline">
              <Button primary style={{ padding: '8px 16px', fontSize: 12 }}>
                New Handover
                <Icon size={13} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="py-12">
        <div className="bt-shell space-y-12">
          {/* Header & Metrics Ribbon */}
          <div>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <span className="inline-flex items-center gap-2 text-[10px] font-mono font-medium text-[#34d399] tracking-wider uppercase px-2.5 py-1 rounded border border-[#234e3b] bg-[#10b981]/10 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                  Live Developer Memory Daemon
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f4f4f5] m-0">
                  Engineering Context Engine
                </h1>
                <p className="text-[14px] text-[#999ba5] mt-2 max-w-2xl leading-relaxed">
                  Real-time reasoning indexed across commits, active IDE tabs, and agent tool calls.
                  Review verified decisions and bus-factor risk mitigations below.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#30333a] bg-[#14161a] text-[#e2e8f0] text-[12px] font-medium hover:border-[#34d399]/40 hover:text-white transition-all no-underline"
                >
                  <span>Open 3D Paper View</span>
                  <Icon size={12} />
                </Link>
              </div>
            </div>

            {/* Quick KPI Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Verified Decisions',
                  val: '42 Claims',
                  sub: '100% PR Grounded',
                  color: '#34d399'
                },
                {
                  label: 'Bus-Factor Alert',
                  val: 'Low (12%)',
                  sub: 'Single maintainer resolved',
                  color: '#60a5fa'
                },
                {
                  label: 'Redacted Credentials',
                  val: '3 Secrets',
                  sub: 'Zero leak boundary enforced',
                  color: '#f59e0b'
                },
                {
                  label: 'Daemon Sync',
                  val: 'Active v2.4',
                  sub: 'MCP & Supabase Connected',
                  color: '#34d399'
                }
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-5 rounded-xl border border-[#27282d] bg-[#131417] flex flex-col justify-between"
                >
                  <span className="text-[11px] font-mono text-[#999ba5] uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <div className="text-2xl font-bold my-2 text-[#f4f4f5]" style={{ color: stat.color }}>
                    {stat.val}
                  </div>
                  <span className="text-[11px] text-[#71747d] font-mono">
                    {stat.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Handover Inspection Code Window */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#f4f4f5] m-0">
                Active Session Handover
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  to="/review"
                  className="text-[12px] font-medium text-[#34d399] hover:underline no-underline flex items-center gap-1"
                >
                  Expand Full Review <Icon size={12} />
                </Link>
              </div>
            </div>

            <div className="w-full">
              <Preview expanded={expanded} setExpanded={setExpanded} />
            </div>
          </div>

          {/* Core Feature Pillars */}
          <div className="border-t border-[#27282d] pt-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Real-Time Reasoning Capture',
                  desc: 'Indexes agent thinking processes and terminal outputs directly into project-scoped vector stores.',
                  icon: 'git'
                },
                {
                  title: 'Bus-Factor Risk Detection',
                  desc: 'Flags code regions dependent on departing engineers before unmerged work goes stale.',
                  icon: 'shield'
                },
                {
                  title: 'Cryptographic Secret Redaction',
                  desc: 'Ensures API tokens, database connection strings, and private keys never leak into handovers.',
                  icon: 'lock'
                }
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[#27282d] bg-[#121316] space-y-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#34d399]/10 border border-[#34d399]/30 flex items-center justify-center text-[#34d399]">
                    <Icon name={f.icon} size={16} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#f4f4f5] m-0">
                    {f.title}
                  </h3>
                  <p className="text-[12px] text-[#999ba5] leading-relaxed m-0">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27282d] bg-[#090a0b] py-8 mt-12">
        <div className="bt-shell flex flex-col sm:flex-row items-center justify-between gap-4">
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

export default DashboardPage

