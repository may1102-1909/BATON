import React, { Suspense, useEffect, useState } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Link } from '../router'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const Scene = React.lazy(() => import('../components/Scene'))

// The 3D scene is skipped on small screens, without WebGL, or when the visitor prefers reduced motion.
function canRunShader() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  if (window.innerWidth < 768) return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const linkStyle = { color: '#f4f4f5', fontSize: 13, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }
const primaryStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 18px',
  borderRadius: 8,
  background: '#10b981',
  color: '#042f21',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
}

export function LandingPage() {
  const [shader] = useState(canRunShader)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data?.session))).catch(() => {})
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        height: shader ? '100vh' : undefined,
        overflow: shader ? 'hidden' : 'auto',
        backgroundColor: '#08080a',
        color: '#f4f4f5',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <header
        style={{
          position: shader ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          minHeight: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 36px'
        }}
      >
        <Link to="/" aria-label="Baton home" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Brand size={22} />
        </Link>

        <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Link to="/demo-page" style={linkStyle}>Try the demo</Link>
          {signedIn ? (
            <Link to="/dashboard" style={primaryStyle}>
              <span>Open dashboard</span>
              <Icon size={12} />
            </Link>
          ) : (
            <>
              <Link to="/auth" style={linkStyle}>Sign in</Link>
              <Link to="/auth" style={primaryStyle}>
                <span>Launch App</span>
                <Icon size={12} />
              </Link>
            </>
          )}
        </nav>
      </header>

      <main id="main">
        {shader ? (
          <>
            <h1 className="sr-only">Baton: evidence-backed engineering handovers</h1>
            <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <Suspense fallback={null}>
                <Scene variant="original" />
              </Suspense>
            </div>
          </>
        ) : (
          <section style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px 96px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(34px, 7vw, 56px)', lineHeight: 1.1, letterSpacing: -1.5, fontWeight: 600, margin: '0 0 20px' }}>
              Pass the knowledge, <span style={{ color: '#34d399' }}>not just the code.</span>
            </h1>
            <p style={{ color: '#a8abb4', fontSize: 17, lineHeight: 1.7, margin: '0 auto 32px', maxWidth: 560 }}>
              Baton connects your Git history and the decisions your team records into cited handover packets, so the
              next engineer starts with evidence instead of guesses.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={signedIn ? '/dashboard' : '/auth'} style={{ ...primaryStyle, padding: '12px 24px', fontSize: 14 }}>
                {signedIn ? 'Open dashboard' : 'Sign in or create an account'}
              </Link>
              <Link to="/demo-page" style={{ ...linkStyle, padding: '12px 24px', border: '1px solid #27282d', borderRadius: 8, fontSize: 14 }}>
                Explore the sample workspace
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default LandingPage
