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

// Persona and step per tour stop; the last stop returns to the admin for the MCP simulator.
const TOUR = [
  { persona: 'demo-admin', text: 'May (Admin): open Overview for bus-factor alerts and the contribution matrix built from BATON\'s real commits, then start a handover from an alert.' },
  { persona: 'demo-leaver', text: 'Leaving engineer: open "Handovers" to answer or skip the risk-ranked exit-interview questions.' },
  { persona: 'demo-incoming', text: 'Incoming engineer: after approval, open the packet from Handovers, ask a question and acknowledge it.' },
  { persona: 'demo-admin', text: 'May (Admin): try the Live MCP simulator; the sample key is redacted before anything is stored.' }
]

export function DemoPage() {
  const { navigate } = useRouter()
  const [activePersona, setActivePersona] = useState(DEMO_PERSONAS.some((p) => p.id === api.getDemoUser()) ? api.getDemoUser() : 'demo-admin')
  const [resetNotice, setResetNotice] = useState(false)
  const [tourStep, setTourStep] = useState(1)
  const [showTour, setShowTour] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)

  // Install before child effects run, so the workspace's first requests are served demo data
  // even after an in-app navigation from /usage. Idempotent.
  installDemoInterceptor(activePersona)

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
              fontFamily: 'monospace'
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
      `}</style>

      {/* Single Unified Header */}
      <header
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              fontSize: 9,
              fontFamily: 'monospace',
              color: C.green,
              background: 'rgba(52, 211, 153, 0.08)',
              border: '1px solid rgba(52, 211, 153, 0.25)',
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: 0.8,
              fontWeight: 600
            }}
          >
            DEMO MODE
          </span>
          <span
            style={{
              fontSize: 11,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              color: '#686e7a',
              fontFamily: 'monospace',
              marginRight: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}
          >
            Viewing as:
          </span>
          {DEMO_PERSONAS.map((p) => {
            const active = activePersona === p.id
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleResetDemo}
            style={{
              background: 'transparent',
              border: `1px solid ${C.line}`,
              color: '#8e939d',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f4f4f5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8e939d')}
          >
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
          demoPersonas={DEMO_PERSONAS}
          demoPersona={activePersona}
          onDemoPersonaChange={handleSwitchPersona}
          demoSimulatorSample={DEMO_SIMULATOR_SAMPLE}
          onBack={() => navigate('/usage')}
          onSignOut={() => navigate('/')}
        />
      </main>

      {/* Floating 1-Click Tour Guide Widget (Docked at bottom-right, never squashes UI) */}
      {showTour && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99999,
            background: 'rgba(17, 19, 23, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid #282c35',
            borderRadius: 12,
            padding: '12px 16px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(52, 211, 153, 0.12)',
            maxWidth: 380,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.green,
                  display: 'inline-block',
                  boxShadow: '0 0 6px #34d399'
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: C.green,
                  fontWeight: 700,
                  letterSpacing: 0.5
                }}
              >
                DEMO GUIDE · STEP {tourStep}/4
              </span>
            </div>
            <button
              onClick={() => setShowTour(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                lineHeight: 1
              }}
              title="Hide guide"
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#e5e7eb', lineHeight: 1.5 }}>
            {TOUR[tourStep - 1].text}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => {
                const nextStep = tourStep > 1 ? tourStep - 1 : TOUR.length
                setTourStep(nextStep)
                handleSwitchPersona(TOUR[nextStep - 1].persona)
              }}
              style={{
                background: 'transparent',
                border: '1px solid #2e333d',
                color: '#9ca3af',
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 10.5
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => {
                const nextStep = tourStep < TOUR.length ? tourStep + 1 : 1
                setTourStep(nextStep)
                handleSwitchPersona(TOUR[nextStep - 1].persona)
              }}
              style={{
                background: 'rgba(52, 211, 153, 0.14)',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                color: C.green,
                padding: '3px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 10.5,
                fontWeight: 600
              }}
            >
              Next Step →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DemoPage
