import React, { useState, useEffect } from 'react'

export function TransitionOverlay({ onComplete, duration = 1000 }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const startTime = performance.now()
    let frameId

    const update = (now) => {
      const elapsed = now - startTime
      const current = Math.min(100, Math.floor((elapsed / duration) * 100))
      setProgress(current)

      if (current < 100) {
        frameId = requestAnimationFrame(update)
      } else {
        setTimeout(() => {
          if (onComplete) onComplete()
        }, 120)
      }
    }

    frameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frameId)
  }, [duration, onComplete])

  const getStatusText = (pct) => {
    if (pct <= 35) return '> INITIALIZING MCP DAEMON...'
    if (pct <= 75) return '> ATTACHING REPOSITORY CONTEXT...'
    return '> DECRYPTING HANDOVER SESSION...'
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md font-mono select-none text-white px-6"
      style={{ animation: 'fadeIn 0.2s ease-out forwards' }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
          50% { text-shadow: 0 0 35px rgba(52, 211, 153, 0.8); }
        }
      `}</style>

      {/* Decorative Top Grid / Scanner */}
      <div className="absolute top-8 left-8 flex items-center gap-2 text-xs text-[#6ee7b7] tracking-widest">
        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
        <span>BATON_KERNEL_V2 // SESSION_BRIDGE</span>
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        {/* Large Percentage Readout */}
        <div
          className="text-6xl sm:text-7xl font-extrabold tracking-tighter text-[#10b981] mb-6"
          style={{ animation: 'pulseGlow 1.5s infinite' }}
        >
          {progress}%
        </div>

        {/* Progress Bar Container */}
        <div className="w-full h-1.5 bg-[#18181b] rounded-full overflow-hidden border border-[#27272a] mb-5">
          <div
            className="h-full bg-gradient-to-r from-[#10b981] to-[#34d399] transition-all duration-75 ease-out rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dynamic Monospace Terminal Log */}
        <div className="h-6 flex items-center justify-center text-xs tracking-wider text-[#a1a1aa]">
          <span className="text-[#34d399] mr-2">●</span>
          <span>{getStatusText(progress)}</span>
        </div>
      </div>

      {/* Bottom Security Citation */}
      <div className="absolute bottom-8 text-[11px] text-[#52525b] tracking-wider">
        ENCRYPTED WORKSPACE HANDOVER PROTOCOL · NO SECRETS TRANSMITTED
      </div>
    </div>
  )
}

export default TransitionOverlay

