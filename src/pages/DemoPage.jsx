import React, { useState, useEffect } from 'react'
import { Brand } from '../components/Brand'
import { Button } from '../components/Button'
import { Workspace } from '../components/Workspace'
import { useRouter } from '../router'
import * as api from '../lib/api.js'
import {
  installDemoInterceptor,
  uninstallDemoInterceptor,
  setDemoPersona,
  resetDemoState,
  DEMO_PERSONAS,
  DEMO_SIMULATOR_SAMPLE,
  isDemoRoute
} from './demoSandbox.js'

// Only when the app is opened directly on /demo-page; otherwise DemoPage installs it while rendering.
if (isDemoRoute()) {
  installDemoInterceptor(api.getDemoUser() || 'demo-admin')
}

const C = {
  bg: '#0c0d0e',
  surface: '#111316',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}


export function DemoPage() {
  const { navigate } = useRouter()
  // The demo is viewed as the admin only; the leaver and incoming engineer appear as team members.
  const [activePersona, setActivePersona] = useState('demo-admin')
  const [resetNotice, setResetNotice] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [inviteResult, setInviteResult] = useState(null)

  // Install before child effects run, so the workspace's first requests are served demo data
  // even after an in-app navigation from /usage. Idempotent.
  installDemoInterceptor(activePersona)

  // Invite links made in the demo point back here; accepting adds the teammate to this demo team.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('join')
    if (!token) return
    window.history.replaceState(null, '', window.location.pathname)
    api.acceptInvite(token)
      .then(res => setInviteResult({ status: 'accepted', organizationId: res?.organization_id, message: `Invite accepted: ${res?.membership?.name ?? 'a new teammate'} joined the team. See Team & Tokens.` }))
      .catch(err => setInviteResult({ status: 'error', message: err.message }))
  }, [])

  // Glowing logo loading transition on page entry
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false)
    }, 850)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    installDemoInterceptor(activePersona)
    return () => {
      uninstallDemoInterceptor()
    }
  }, [activePersona])

  const handleSwitchPersona = (personaId) => {
    setActivePersona(personaId)
    setDemoPersona(personaId)
    api.setDemoUser(personaId)
  }

  const handleResetDemo = () => {
    resetDemoState()
    api.setDemoUser('demo-admin')
    setDemoPersona('demo-admin')
    setActivePersona('demo-admin')
    setResetNotice(true)
    setTimeout(() => {
      setResetNotice(false)
      window.location.reload()
    }, 400)
  }

  // 1. Loading screen with signature glowing logo transition
  if (isInitializing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <style>{`
          @keyframes batonLoaderGlow {
            0% {
              opacity: 0.65;
              filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.2));
              transform: scale(0.97);
            }
            50% {
              opacity: 1;
              filter: drop-shadow(0 0 16px rgba(52, 211, 153, 0.75));
              transform: scale(1.03);
            }
            100% {
              opacity: 0.65;
              filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.2));
              transform: scale(0.97);
            }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ animation: 'batonLoaderGlow 2.2s ease-in-out infinite' }}>
            <Brand size={36} iconOnly />
          </div>
          <div
            style={{
              color: C.muted,
              fontSize: '0.88rem',
              letterSpacing: '0.04em',
              fontFamily: 'var(--mono)'
            }}
          >
            Loading Baton Workspace...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="demo-page-root"
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Scoped CSS: Hide internal duplicate Workspace header so there is ONLY ONE header */}
      <style>{`
        .demo-page-root .ws-header {
          display: none !important;
        }
        .demo-page-root .ws-container {
          min-height: calc(100vh - 60px) !important;
        }
        @media (max-width: 760px) {
          .demo-page-root .demo-header { height: auto !important; flex-wrap: wrap; gap: 8px 10px; padding: 10px 14px !important; }
          .demo-page-root .demo-header-left { gap: 10px !important; }
          .demo-page-root .demo-org-chip, .demo-page-root .demo-persona > span:first-child { display: none; }
          .demo-page-root .demo-actions { width: 100%; gap: 8px !important; }
          .demo-page-root .demo-actions > button { flex: 1; justify-content: center; padding: 8px 10px !important; font-size: 12.5px !important; }
        }
      `}</style>

      {/* Single Unified Header */}
      <header className="demo-header"
        style={{
          height: 60,
          background: '#0d0f12',
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(16px)'
        }}
      >
        {/* Left: Brand + Demo Badge + Org Tag */}
        <div className="demo-header-left" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={() => navigate('/usage')}
            title="← Back to Usage / Home"
            aria-label="Back to Usage"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              outline: 'none',
              transition: 'transform 0.2s ease, filter 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)'
              e.currentTarget.style.filter = 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.55))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.filter = 'none'
            }}
          >
            <Brand size={20} />
          </button>
          <span
            style={{
              fontSize: 12,
              color: C.green,
              border: '1px solid rgba(52, 211, 153, 0.4)',
              padding: '0 8px',
              borderRadius: 999,
              lineHeight: '20px',
              fontWeight: 500
            }}
          >
            Demo
          </span>
          <span className="demo-org-chip"
            style={{
              fontSize: 12,
              color: '#9ca3af',
              background: '#16181d',
              border: '1px solid #282c35',
              padding: '3px 10px',
              borderRadius: 6,
              fontFamily: 'inherit'
            }}
          >
            Mumbai_wale Hackathon Org · DEMO
          </span>
        </div>

        {/* Center: Persona Switcher */}
        <div className="demo-persona" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              color: '#8b949e',
              marginRight: 4
            }}
          >
            Viewing as
          </span>
          {DEMO_PERSONAS.filter((p) => p.id === 'demo-admin').map((p) => {
            const active = true
            return (
              <button
                key={p.id}
                onClick={() => handleSwitchPersona(p.id)}
                style={{
                  background: active ? 'rgba(52, 211, 153, 0.12)' : 'transparent',
                  border: `1px solid ${active ? C.green : '#252830'}`,
                  color: active ? C.green : '#9499a4',
                  borderRadius: 20,
                  padding: '4px 11px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.18s ease',
                  boxShadow: active ? '0 0 12px rgba(52, 211, 153, 0.2)' : 'none',
                  fontFamily: 'inherit'
                }}
              >
                {p.name}
                {p.id !== 'demo-admin' && (
                  <span style={{ fontSize: 9.5, opacity: 0.7 }}> ({p.role})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Right: Actions */}
        <div className="demo-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleResetDemo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#191a1e',
              border: '1px solid rgba(52, 211, 153, 0.45)',
              color: '#d1fae5',
              borderRadius: 6,
              padding: '9px 16px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.color = '#f4f4f5' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#191a1e'; e.currentTarget.style.color = '#d1fae5' }}
          >
            <span aria-hidden="true">↺</span>
            {resetNotice ? 'Resetting...' : 'Reset Demo'}
          </button>
          <Button
            primary
            onClick={() => {
              localStorage.setItem('baton_mode', 'production')
              navigate('/dashboard')
            }}
            style={{
              padding: '5px 13px',
              fontSize: 11.5,
              borderRadius: 6
            }}
          >
            Switch to Production →
          </Button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main style={{ flex: 1 }}>
        <Workspace
          key={activePersona}
          mode="demo"
          inviteResult={inviteResult}
          demoPersonas={DEMO_PERSONAS}
          demoPersona={activePersona}
          onDemoPersonaChange={handleSwitchPersona}
          demoSimulatorSample={DEMO_SIMULATOR_SAMPLE}
          onBack={() => navigate('/usage')}
          onSignOut={() => navigate('/')}
        />
      </main>

    </div>
  )
}

export default DemoPage
