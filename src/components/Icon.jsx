import React from 'react'

export function Icon({ name = 'arrow', size = 18, style }) {
  const paths = {
    arrow: <path d="M5 12h14M12 5l7 7-7 7" />,
    back: <path d="M19 12H5m7-7-7 7 7 7" />,
    external: (
      <>
        <path d="M15 3h6v6m0-6L10 14" />
        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    git: (
      <>
        <circle cx="6" cy="3" r="2" />
        <circle cx="6" cy="21" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M6 5v14m12-11a6 6 0 0 1-6 6H6" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 6 10 7 10-7" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    code: <path d="m8 5-7 7 7 7m8-14 7 7-7 7m-3-16-2 20" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    github: (
      <path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-3c3-.3 6-1.5 6-6a4.7 4.7 0 0 0-1.3-3.3A4.3 4.3 0 0 0 18.6 2S17.4 1.7 15 3.3a13.4 13.4 0 0 0-6 0C6.6 1.7 5.4 2 5.4 2a4.3 4.3 0 0 0-.1 3.7A4.7 4.7 0 0 0 4 9c0 4.5 3 5.7 6 6a3.5 3.5 0 0 0-1 3v4" />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name] || paths.arrow}
    </svg>
  )
}
