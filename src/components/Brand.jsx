import React from 'react'

export function Brand({ size = 22 }) {
  return (
    <span
      className="inline-flex items-center select-none no-underline group"
      style={{
        gap: 9,
        textDecoration: 'none'
      }}
    >
      <span className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105 flex-shrink-0">
        <svg
          width={Math.round((24 / 22) * size)}
          height={Math.round((28 / 22) * size)}
          viewBox="0 0 25 29"
          fill="none"
          aria-hidden="true"
        >
          <path d="m3 17 10-14 6 4L9 21z" fill="#34d399" />
          <path d="m7 22 10-14 6 4-10 14z" fill="#10b981" />
        </svg>
      </span>
      <span
        style={{
          fontFamily: '"Plus Jakarta Sans", "Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '-0.035em',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
        }}
      >
        BATON
      </span>
      <span
        style={{
          fontSize: Math.max(9, Math.round(size * 0.41)),
          fontFamily: '"JetBrains Mono", monospace',
          color: '#10b981',
          opacity: 0.85,
          fontWeight: 600,
          marginLeft: -3,
          alignSelf: 'flex-start',
          lineHeight: 1
        }}
      >
        ®
      </span>
    </span>
  )
}
