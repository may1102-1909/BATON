import React, { useState, useEffect } from 'react'
import Baton from '../ClassicApp'
import { useRouter } from '../router'

const NAV_ITEMS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'features',     label: 'Features' },
  { id: 'workflow',     label: 'Workflow' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'docs',         label: 'Docs' },
]

function getTargetElement(id) {
  if (id === 'overview') return document.querySelector('.bt-hero')

  if (id === 'docs') {
    return document.querySelector('details') || document.querySelector('summary')?.closest('section')
  }

  const targetMap = {
    features: 'A handover. Not a guessing game.',
    workflow: 'Fits into the tools you already run.',
    architecture: 'From scattered context to shared clarity.'
  }

  const text = targetMap[id]
  if (!text) return null

  for (const h2 of document.querySelectorAll('h2')) {
    if (h2.textContent?.includes(text)) {
      return h2.closest('section') || h2.closest('div') || h2
    }
  }
  return null
}

function getTopOf(id) {
  if (id === 'overview') return 0
  const el = getTargetElement(id)
  return el ? el.getBoundingClientRect().top + window.scrollY : Infinity
}

function scrollToSection(id) {
  if (id === 'overview') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  // 1. Trigger the built-in React ref handler on ClassicApp's nav button
  const navButtons = document.querySelectorAll('.bt-navlinks button')
  for (const btn of navButtons) {
    if (btn.textContent?.trim().toLowerCase() === id.toLowerCase()) {
      btn.click()
      if (id === 'docs') {
        const details = document.querySelector('details')
        if (details) details.open = true
        setTimeout(() => {
          details?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 50)
      }
      return
    }
  }

  // 2. Direct DOM scroll fallback
  const el = getTargetElement(id)
  if (el) {
    if (id === 'docs') {
      const details = document.querySelector('details')
      if (details) details.open = true
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function TOCSidebar({ activeId, onNavigate }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 116,
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

      {/* Clean minimal links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV_ITEMS.map(({ id, label }) => {
          const active = activeId === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '5px 0',
                cursor: 'pointer',
                color: active ? '#34d399' : '#6b7280',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.5,
                transition: 'color 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e5e7eb' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6b7280' }}
            >
              {label}
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

  // Track active section accurately on scroll
  useEffect(() => {
    const onScroll = () => {
      // If user is at or near the very bottom of the page, activate 'docs'
      const isAtBottom =
        window.innerHeight + window.scrollY >= (document.documentElement.scrollHeight - 120)
      if (isAtBottom) {
        setActiveId('docs')
        return
      }

      const scrollY = window.scrollY + 180
      const positions = NAV_ITEMS.map(({ id }) => ({ id, top: getTopOf(id) }))
        .filter(p => p.top !== Infinity)
        .sort((a, b) => a.top - b.top)

      let current = 'overview'
      for (const { id, top } of positions) {
        if (scrollY >= top) current = id
      }
      setActiveId(current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNavigate = (id) => {
    setActiveId(id)
    scrollToSection(id)
  }

  return (
    <div className="usage-page-wrapper" style={{ position: 'relative', background: '#0c0d0e', minHeight: '100vh' }}>
      {/* Scoped styles for /usage page */}
      <style>{`
        /* Constrain content width so it never crowds the right sidebar */
        .usage-page-wrapper .bt-shell {
          max-width: 980px !important;
          padding: 0 32px !important;
        }

        /* Hide Features, Workflow, Architecture, Docs from top nav (keeping 3D Paper and Dashboard) */
        .usage-page-wrapper .bt-navlinks button:nth-child(n+3) {
          display: none !important;
        }

        /* Remove the intro paragraph text beneath the main headline */
        .usage-page-wrapper .bt-hero .bt-title + p {
          display: none !important;
        }

        /* Balanced bottom spacing for headline when paragraph is removed */
        .usage-page-wrapper .bt-hero .bt-title {
          margin-bottom: 34px !important;
        }

        /* Overview (Hero) occupies full viewport so nothing peeks from below */
        .usage-page-wrapper .bt-hero {
          min-height: calc(100vh - 120px) !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
          padding: 40px 0 60px !important;
          box-sizing: border-box !important;
        }

        /* Ensure sections with scrollMargin have clean spacing */
        .usage-page-wrapper section[ref] {
          scroll-margin-top: 100px !important;
        }

        .usage-page-wrapper details {
          padding-bottom: 40px !important;
        }

        @media (max-width: 1140px) {
          .baton-toc { display: none !important; }
          .usage-page-wrapper .bt-shell {
            max-width: 100% !important;
            padding: 0 20px !important;
          }
        }
      `}</style>

      {/* Top banner */}
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
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399' }} />
          <strong>Welcome to Baton!</strong> Explore product usage below or continue directly to your workspace.
        </span>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: '#34d399',
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

      {/* ClassicApp rendering */}
      <Baton
        initialScreen="landing"
        primaryActionLabel="View Dashboard"
        onPrimaryAction={() => navigate('/dashboard')}
      />

      {/* Right sidebar */}
      <div className="baton-toc">
        <TOCSidebar activeId={activeId} onNavigate={handleNavigate} />
      </div>
    </div>
  )
}

export default UsagePage

