import React, { useState } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Preview } from '../components/Preview'
import { Link } from '../router'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

export function ReviewPage() {
  const [expanded, setExpanded] = useState(0)
  const [approved, setApproved] = useState(false)

  return (
    <div
      className="relative w-full min-h-screen text-[#f4f4f5] selection:bg-[#34d399]/30 selection:text-white"
      style={{ background: C.bg }}
    >
      {/* Top Nav */}
      <header className="bt-nav sticky top-0 z-50 border-b border-[#27282d] bg-[#0c0d0ee6] backdrop-blur-md">
        <div className="bt-shell h-[76px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="cursor-pointer no-underline flex items-center">
              <Brand size={24} />
            </Link>
            <span className="text-[#45484f]">/</span>
            <span className="text-[12px] font-mono font-medium text-[#34d399] tracking-wider uppercase">
              Handover Review
            </span>
          </div>

          <nav className="bt-navlinks hidden md:flex items-center gap-6" aria-label="Review navigation">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              <Icon name="back" size={13} />
              3D Paper
            </Link>
            <Link
              to="/dashboard"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Dashboard
            </Link>
            <Link
              to="/review"
              className="text-[12px] font-semibold text-[#34d399] no-underline"
            >
              Handover Review
            </Link>
            <Link
              to="/tasks"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Tasks
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              primary={approved}
              onClick={() => setApproved(!approved)}
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              {approved ? '✓ Handover Approved' : 'Sign & Approve Handover'}
              <Icon name={approved ? 'check' : 'arrow'} size={13} />
            </Button>
          </div>
        </div>
      </header>

      {/* Review Viewport */}
      <main className="py-12">
        <div className="bt-shell max-w-4xl space-y-8">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-xl border border-[#27282d] bg-[#121316]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30">
                  HANDOVER SPECIFICATION
                </span>
                <span className="text-[11px] font-mono text-[#888c96]">
                  ID: #HO-2026-42
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#f4f4f5] m-0">
                Rahul S. ⟶ Priya M.
              </h1>
              <p className="text-[13px] text-[#999ba5] mt-1 m-0">
                Role: Senior Backend Platform Engineer · Project: <code className="text-[#34d399]">core-platform</code>
              </p>
            </div>

            <div className="flex sm:flex-col items-end gap-2 text-right">
              <span className="text-[11px] font-mono text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/30 px-2 py-1 rounded">
                Verified v3
              </span>
              <span className="text-[11px] text-[#6b7280]">
                Last reasoning sync: 12 mins ago
              </span>
            </div>
          </div>

          {/* Full Interactive Handover Inspector */}
          <div className="w-full">
            <Preview expanded={expanded} setExpanded={setExpanded} />
          </div>

          {/* Verification Audit Log */}
          <div className="p-6 rounded-xl border border-[#27282d] bg-[#121316] space-y-4">
            <h3 className="text-[15px] font-semibold text-[#f4f4f5] m-0 flex items-center gap-2">
              <Icon name="shield" size={16} style={{ color: '#34d399' }} />
              Cryptographic Verification & Redaction Log
            </h3>
            <div className="space-y-2 text-[12px] font-mono text-[#999ba5]">
              <div className="p-3 rounded bg-[#0a0b0d] border border-[#1f2126] flex items-center justify-between">
                <span>[PR #42] Firebase to Supabase Migration</span>
                <span className="text-[#34d399]">SHA: 8ec1b71c (Approved by Rahul S.)</span>
              </div>
              <div className="p-3 rounded bg-[#0a0b0d] border border-[#1f2126] flex items-center justify-between">
                <span>[Branch feat/pay] Webhook Signature Verification</span>
                <span className="text-[#e8b86d]">INFERRED (Unmerged commit c82f)</span>
              </div>
              <div className="p-3 rounded bg-[#0a0b0d] border border-[#1f2126] flex items-center justify-between">
                <span>[Quarantine] 3 Environment Secret Tokens</span>
                <span className="text-[#60a5fa]">REDACTED (0 Leaks Detected)</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ReviewPage

