import React from 'react'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

export function Button({ primary, style, children, ...props }) {
  return (
    <button
      {...props}
      className={`bt-button ${props.className || ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '12px 20px',
        borderRadius: 6,
        border: `1px solid ${primary ? '#46d9a7' : C.line}`,
        background: primary ? '#34d399' : '#191a1e',
        color: primary ? '#052e22' : C.text,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        ...style
      }}
    >
      {children}
    </button>
  )
}
