import React, { useState, useEffect, useRef } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Comparison } from '../components/Comparison'
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
  { id: 'overview', label: 'Overview' },
  { id: 'docs', label: 'Developer Notes' },
  { id: 'features', label: 'Features' },
]

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
        margin: '34px auto 0',
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
          top: -58,
          left: -24,
          width: 120,
          height: 120,
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
          top: -58,
          right: -24,
          width: 120,
          height: 120,
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

function TOCSidebar({ activeId, onNavigate }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 145,
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
              type="button"
              onClick={(e) => {
                e.preventDefault()
                onNavigate(id)
              }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
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
                animation: `tocItemEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.35 + index * 0.08}s both`,
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
  const docsRef = useRef(null)
  const featuresRef = useRef(null)
  const isClickingRef = useRef(false)
  const clickTimeoutRef = useRef(null)

  const scrollToSection = (id) => {
    setActiveId(id)
    isClickingRef.current = true
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    clickTimeoutRef.current = setTimeout(() => {
      isClickingRef.current = false
    }, 850)

    if (id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const refMap = {
      docs: docsRef,
      features: featuresRef
    }

    const targetRef = refMap[id]
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect()
      const targetY = rect.top + window.scrollY - 85
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' })
    }
  }

  // Accurate scroll tracking
  useEffect(() => {
    const onScroll = () => {
      if (isClickingRef.current) return

      const scrollY = window.scrollY
      const windowH = window.innerHeight

      // If scrolled to bottom of document, select features
      if (windowH + scrollY >= document.documentElement.scrollHeight - 70) {
        setActiveId('features')
        return
      }

      // If near top of page, select overview
      if (scrollY < 120) {
        setActiveId('overview')
        return
      }

      // Viewport probe point (user's focus area: top 35% of screen)
      const probeY = scrollY + Math.min(320, windowH * 0.35)

      const getTop = (el) => el ? el.getBoundingClientRect().top + scrollY : Infinity
      const docsTop = getTop(docsRef.current)
      const featuresTop = getTop(featuresRef.current)

      if (probeY >= featuresTop) {
        setActiveId('features')
      } else if (probeY >= docsTop) {
        setActiveId('docs')
      } else {
        setActiveId('overview')
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    }
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

        /* Subtle vertical bob for story prompt down arrow */
        @keyframes storyArrowBob {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(3px);
          }
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

          {/* Technical Protocol Badge on right side */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid #272a31',
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#9499a4',
                letterSpacing: 0.3
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.green,
                  boxShadow: '0 0 6px #34d399',
                  display: 'inline-block'
                }}
              />
              <span>Autonomous Handover Protocol</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="bt-shell">
          {/* Hero Section */}
          <section
            className="bt-hero"
            ref={heroRef}
            style={{
              paddingTop: 130,
              paddingBottom: 90
            }}
          >
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
              padding: '22px 0',
              marginTop: 40,
              marginBottom: 48,
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

          {/* Workspace Mode Selection */}
          <section
            style={{
              padding: '36px 0 46px',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <div
              style={{
                color: C.green,
                fontSize: 10,
                letterSpacing: 2,
                fontFamily: 'monospace',
                marginBottom: 10,
                fontWeight: 600
              }}
            >
              WORKSPACE MODE
            </div>
            <h2
              style={{
                fontSize: 34,
                fontWeight: 500,
                letterSpacing: -1.2,
                margin: '0 auto 24px',
                maxWidth: 440,
                color: '#f4f4f5'
              }}
            >
              Choose your experience.
            </h2>

            {/* Dual Mode Buttons sized proportionally to the title */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                maxWidth: 440,
                margin: '0 auto',
                flexWrap: 'wrap'
              }}
            >
              {/* Demo Mode Button */}
              <button
                onClick={() => {
                  localStorage.setItem('baton_mode', 'demo')
                  navigate('/demo-page')
                }}
                style={{
                  flex: '1 1 185px',
                  minWidth: 180,
                  height: 48,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 24px',
                  borderRadius: 8,
                  background: '#131518',
                  border: '1px solid #282c35',
                  color: '#f4f4f5',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.55)'
                  e.currentTarget.style.boxShadow = '0 0 28px rgba(52, 211, 153, 0.25), 0 8px 24px rgba(0, 0, 0, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = '#282c35'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.35)'
                }}
              >
                Demo Mode
              </button>

              {/* Production Mode Button */}
              <button
                onClick={() => {
                  localStorage.setItem('baton_mode', 'production')
                  navigate('/dashboard')
                }}
                style={{
                  flex: '1 1 185px',
                  minWidth: 180,
                  height: 48,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '0 24px',
                  borderRadius: 8,
                  background: '#34d399',
                  border: '1px solid #4ade80',
                  color: '#052e22',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 4px 20px rgba(52, 211, 153, 0.28)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 0 34px rgba(52, 211, 153, 0.55), 0 8px 24px rgba(0, 0, 0, 0.5)'
                  const arrow = e.currentTarget.querySelector('.prod-arrow')
                  if (arrow) arrow.style.transform = 'translateX(3px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(52, 211, 153, 0.28)'
                  const arrow = e.currentTarget.querySelector('.prod-arrow')
                  if (arrow) arrow.style.transform = 'translateX(0)'
                }}
              >
                <span>Production Mode</span>
                <span
                  className="prod-arrow"
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    display: 'inline-block',
                    transition: 'transform 0.2s ease',
                    lineHeight: 1
                  }}
                >
                  →
                </span>
              </button>
            </div>

            {/* Featherweight Story prompt - sleek, non-intrusive micro-link */}
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                onClick={() => scrollToSection('docs')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b929d',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  transition: 'color 0.2s ease',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#34d399'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#8b929d'
                }}
              >
                <span>Why we built Baton</span>
                <span
                  style={{
                    fontSize: 12,
                    color: '#34d399',
                    display: 'inline-block',
                    animation: 'storyArrowBob 1.8s ease-in-out infinite',
                    lineHeight: 1
                  }}
                >
                  ↓
                </span>
              </button>
            </div>
          </section>

          <SectionDivider />

          {/* Developer Notes / Docs Section */}
          <section
            ref={docsRef}
            style={{ padding: '48px 0 130px', scrollMarginTop: 85 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  color: C.green,
                  fontSize: 10,
                  letterSpacing: 1.7,
                  fontFamily: 'monospace',
                  marginBottom: 8,
                  fontWeight: 600
                }}
              >
                DEVELOPER NOTES
              </div>
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: -0.8,
                  margin: 0,
                  color: '#f4f4f5'
                }}
              >
                Behind the code.
              </h2>
            </div>

            {/* Dialogue Table Card with Stickers */}
            <DeveloperNotesCard />
          </section>

          <SectionDivider />

          {/* Features Section */}
          <section
            ref={featuresRef}
            style={{ padding: '130px 0 160px', scrollMarginTop: 100 }}
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

          {/* Comparison */}
          <div style={{ padding: '130px 0 160px' }}>
            <Comparison />
          </div>
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
