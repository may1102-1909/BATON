// Framer Source: import Baton from "https://framer.com/m/Baton-9klTSK.js@jX5iVIgojAlxgrHyMaLC"
import React from 'react'
import Baton from '../ClassicApp'
import { useRouter } from '../router'

export function UsagePage() {
  const { navigate } = useRouter()

  return (
    <div style={{ position: 'relative' }}>
      {/* Top Transition Banner for Post-Signup Flow */}
      <div
        style={{
          background: 'linear-gradient(90deg, #0d1e17, #10291f, #0d1e17)',
          borderBottom: '1px solid #1f4f39',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontSize: 12,
          color: '#e2f7ed',
          zIndex: 60,
          position: 'sticky',
          top: 0
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399' }} />
          <strong>Welcome to Baton!</strong> Explore product usage below or continue directly to your workspace.
        </span>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: '#34d399',
            color: '#052e22',
            border: 0,
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span>View Dashboard</span>
          <span>→</span>
        </button>
      </div>

      {/* Render Baton Framer Component with 'View Dashboard' action */}
      <Baton
        initialScreen="landing"
        primaryActionLabel="View Dashboard"
        onPrimaryAction={() => navigate('/dashboard')}
      />
    </div>
  )
}

export default UsagePage

