import React from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Scene } from '../components/Scene'
import { Link } from '../router'

export function LandingPage() {
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

      {/* Sleek Minimalist Top Navigation Bar */}
      <header
        className="absolute top-0 left-0 right-0 z-50 h-[72px] flex items-center justify-between px-6 sm:px-12 pointer-events-auto"
        style={{
          animation: 'navbarFadeSlideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both'
        }}
      >
        <Link to="/" className="flex items-center gap-3 no-underline">
          <Brand size={22} />
        </Link>

        {/* Top Navigation Links */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e3239] bg-[#14161a]/70 backdrop-blur-md text-[#d0d4dc] text-[12px] font-medium hover:border-[#10b981]/50 hover:text-white transition-all no-underline cursor-pointer"
          >
            <span>Dashboard</span>
          </Link>

          <Link
            to="/handover/active"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e3239] bg-[#14161a]/70 backdrop-blur-md text-[#d0d4dc] text-[12px] font-medium hover:border-[#34d399]/50 hover:text-emerald-400 transition-all no-underline cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span>Review Handover</span>
          </Link>

          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#2e3239] bg-[#14161a]/70 backdrop-blur-md text-[#e2e8f0] text-[12px] font-medium hover:border-[#10b981]/50 hover:text-white transition-all no-underline cursor-pointer"
          >
            <span>Sign In</span>
          </Link>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#10b981] text-[#042f21] text-[12px] font-semibold font-sans transition-all hover:bg-[#34d399] hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] no-underline cursor-pointer shadow-md"
          >
            <span>Launch App</span>
            <Icon size={12} />
          </Link>
        </div>
      </header>

      {/* Floating Bottom Quick-Access Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <div className="flex items-center gap-2 bg-[#121417]/80 backdrop-blur-md border border-[#272a30] px-4 py-2 rounded-full shadow-2xl">
          <span className="text-[11px] font-mono text-[#8a8f9c] mr-1 hidden sm:inline">Explore Baton:</span>
          <Link
            to="/dashboard"
            className="text-[11px] font-medium text-[#d0d4dc] hover:text-[#34d399] px-2.5 py-1 rounded bg-[#1a1d22] hover:bg-[#20252c] transition no-underline"
          >
            📊 Dashboard
          </Link>
          <Link
            to="/handover/active"
            className="text-[11px] font-medium text-[#34d399] hover:text-emerald-300 px-2.5 py-1 rounded bg-[#10b98115] border border-[#25523f] hover:bg-[#10b98125] transition no-underline"
          >
            ⚡ Handover Review
          </Link>
          <Link
            to="/auth"
            className="text-[11px] font-medium text-[#d0d4dc] hover:text-white px-2.5 py-1 rounded bg-[#1a1d22] hover:bg-[#20252c] transition no-underline"
          >
            🔐 Auth
          </Link>
        </div>
      </div>

      {/* Full-Screen Centered 3D Paper Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <Scene variant="original" />
      </div>
    </div>
  )
}

export default LandingPage
