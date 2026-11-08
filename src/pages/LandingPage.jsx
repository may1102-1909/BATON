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

        {/* Top-Right CTA Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/review"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#2e3239] bg-[#14161a]/70 backdrop-blur-md text-[#e2e8f0] text-[12px] font-medium font-sans hover:border-[#10b981]/50 hover:bg-[#1a1d22] hover:text-white transition-all no-underline cursor-pointer"
          >
            <Icon name="code" size={13} style={{ color: '#10b981' }} />
            <span>Live Demo</span>
          </Link>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#10b981] text-[#042f21] text-[12px] font-semibold font-sans transition-all hover:bg-[#34d399] hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] no-underline cursor-pointer shadow-md"
          >
            <span>Get Started</span>
            <Icon size={12} />
          </Link>
        </div>
      </header>

      {/* Full-Screen Centered 3D Paper Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <Scene variant="original" />
      </div>
    </div>
  )
}

export default LandingPage
