import React from 'react'

export function Brand({ size = 23 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontWeight: 750,
        fontSize: size,
        letterSpacing: '-0.8px',
        color: '#f4f4f5',
        userSelect: 'none',
        textDecoration: 'none'
      }}
    >
      <svg
        width={Math.round((25 / 23) * size)}
        height={Math.round((29 / 23) * size)}
        viewBox="0 0 25 29"
        fill="none"
        aria-hidden="true"
      >
        <path d="m3 17 10-14 6 4L9 21z" fill="#34d399" />
        <path d="m7 22 10-14 6 4-10 14z" fill="#10b981" />
      </svg>
      BATON
      <span style={{ fontSize: Math.max(9, Math.round(size * 0.43)), color: '#666', alignSelf: 'start', marginLeft: -3 }}>
        ®
      </span>
    </span>
  )
}

