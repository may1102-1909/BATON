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

        {/* Top CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/demo-page"
            style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
          >
            Try the demo
          </Link>
          <Link
            to="/auth"
            style={{
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
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            <span>Launch App</span>
            <Icon size={12} />
          </Link>
        </div>
      </header>

      {/* Full-Screen Centered 3D Paper Canvas */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <Scene variant="original" />
      </div>
    </div>
  )
}

export default LandingPage
