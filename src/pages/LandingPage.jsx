import React, { useState } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Scene } from '../components/Scene'
import { TransitionOverlay } from '../components/TransitionOverlay'
import { Link, useRouter } from '../router'

export function LandingPage() {
  const { navigate } = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleGetStarted = (e) => {
    if (e) e.preventDefault()
    setIsTransitioning(true)
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#08080a] text-[#f4f4f5] select-none font-sans">
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

      {/* Sleek Minimalist Top Navigation Bar: BATON logo on left, Get Started → on right */}
      <header
        className="absolute top-0 left-0 right-0 z-50 h-[72px] flex items-center justify-between px-6 sm:px-12 pointer-events-auto"
        style={{
          animation: 'navbarFadeSlideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both'
        }}
      >
        <Link to="/" className="flex items-center gap-3 no-underline">
          <Brand size={22} />
        </Link>

        {/* Top-Right CTA Button: Get Started → */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 font-medium text-[13px] font-sans shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-200 cursor-pointer"
          >
            <span>Get Started &rarr;</span>
            <Icon size={12} style={{ color: '#34d399' }} />
          </button>
        </div>
      </header>

      {/* Full-Screen Centered 3D Paper Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <Scene
          variant="original"
          onAction={(action) => {
            if (action === 'get-started' || action === 'dashboard') {
              setIsTransitioning(true)
            }
          }}
        />
      </div>

      {/* 0-100% Developer Transition Overlay */}
      {isTransitioning && (
        <TransitionOverlay
          duration={1000}
          onComplete={() => {
            navigate('/dashboard')
          }}
        />
      )}
    </div>
  )
}

export default LandingPage
