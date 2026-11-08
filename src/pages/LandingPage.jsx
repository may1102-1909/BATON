import React from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Scene } from '../components/Scene'
import { Link } from '../router'

export function LandingPage() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#08080a',
        color: '#f4f4f5',
        userSelect: 'none',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <style>{`
        @keyframes navbarFadeSlideDown {
          0% {
            opacity: 0;
            transform: translateY(-12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Sleek Minimalist Top Navigation Bar */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 36px',
          pointerEvents: 'auto',
          animation: 'navbarFadeSlideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both'
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Brand size={22} />
        </Link>

        {/* Top Navigation Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #2e3239',
              background: 'rgba(20, 22, 26, 0.75)',
              backdropFilter: 'blur(12px)',
              color: '#d0d4dc',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <span>Dashboard</span>
          </Link>

          <Link
            to="/dashboard/handover/active"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid rgba(52, 211, 153, 0.35)',
              background: 'rgba(16, 185, 129, 0.1)',
              backdropFilter: 'blur(12px)',
              color: '#34d399',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
            <span>Review Handover</span>
          </Link>

          <Link
            to="/auth"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #2e3239',
              background: 'rgba(20, 22, 26, 0.75)',
              backdropFilter: 'blur(12px)',
              color: '#e2e8f0',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <span>Sign In</span>
          </Link>

          <Link
            to="/auth"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 16px',
              borderRadius: 8,
              background: '#10b981',
              color: '#042f21',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
            }}
          >
            <span>Launch App</span>
            <Icon size={12} />
          </Link>
        </div>
      </header>

      {/* Floating Bottom Quick-Access Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'auto'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(18, 20, 23, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid #272a30',
            padding: '8px 16px',
            borderRadius: 9999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8a8f9c', marginRight: 4 }}>
            Explore Baton:
          </span>
          <Link
            to="/dashboard"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#d0d4dc',
              padding: '5px 10px',
              borderRadius: 6,
              background: '#1a1d22',
              textDecoration: 'none'
            }}
          >
            📊 Dashboard
          </Link>
          <Link
            to="/dashboard/handover/active"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#34d399',
              padding: '5px 10px',
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #25523f',
              textDecoration: 'none'
            }}
          >
            ⚡ Handover Review
          </Link>
          <Link
            to="/auth"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#d0d4dc',
              padding: '5px 10px',
              borderRadius: 6,
              background: '#1a1d22',
              textDecoration: 'none'
            }}
          >
            🔐 Auth
          </Link>
        </div>
      </div>

      {/* Full-Screen Centered 3D Paper Canvas */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <Scene variant="original" />
      </div>
    </div>
  )
}

export default LandingPage
