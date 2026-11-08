import React from 'react'
import { Icon } from './Icon'

const comparisonPoints = [
  {
    topic: 'Architectural Decisions',
    without: 'Scattered across Slack threads, Google Docs, and forgotten 1-on-1 calls.',
    with: 'Directly extracted from git commits, PR discussions, and AI coding agent session traces.'
  },
  {
    topic: 'Verifiability & Trust',
    without: 'Assumptions and guesswork. Incoming engineers have no way to verify if a note is up to date.',
    with: 'Cryptographically cited sources. Verified, Inferred, and Conflicting claims stay explicit.'
  },
  {
    topic: 'Credentials & Security',
    without: 'Accidental secret exposure when engineers dump environment variables into shared documents.',
    with: 'Automated secret redaction and role-based clearance boundaries prior to handover generation.'
  },
  {
    topic: 'Onboarding Acceleration',
    without: '4 to 6 weeks of tribal knowledge hunting and asking departed engineers for guidance.',
    with: 'Day-one clarity. Incoming engineers start shipping with zero context loss.'
  }
]

export function Comparison() {
  return (
    <section style={{ padding: '60px 0', borderTop: '1px solid #27282d' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div
          style={{
            color: '#34d399',
            fontSize: 10,
            letterSpacing: 1.7,
            fontFamily: 'monospace',
            marginBottom: 10,
            fontWeight: 600
          }}
        >
          THE CONTINUITY ADVANTAGE
        </div>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: -1,
            margin: '0 0 10px',
            color: '#f4f4f5'
          }}
        >
          Stop losing tribal knowledge with every departure.
        </h2>
        <p
          style={{
            fontSize: 13,
            color: '#999ba5',
            margin: '0 auto',
            maxWidth: 500,
            lineHeight: 1.8
          }}
        >
          Compare standard legacy handovers with Baton’s verifiable, AI-assisted continuity framework.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          maxWidth: 1040,
          margin: '0 auto'
        }}
      >
        {/* Without Baton */}
        <div
          style={{
            background: '#131416',
            border: '1px solid #2c2f35',
            borderRadius: 10,
            padding: '30px 26px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#ef8585',
              marginBottom: 20
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: '#ef858518',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12
              }}
            >
              ✕
            </span>
            Without Baton
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {comparisonPoints.map((item) => (
              <div key={item.topic}>
                <div style={{ fontSize: 11, color: '#888d96', fontFamily: 'monospace', marginBottom: 4 }}>
                  {item.topic}
                </div>
                <div style={{ fontSize: 12, color: '#aaadb8', lineHeight: 1.6 }}>
                  {item.without}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* With Baton */}
        <div
          style={{
            background: 'linear-gradient(145deg, #121816, #111415)',
            border: '1px solid #234c38',
            borderRadius: 10,
            padding: '30px 26px',
            boxShadow: '0 0 50px rgba(52, 211, 153, 0.05)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#34d399',
              marginBottom: 20
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: '#10b98122',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12
              }}
            >
              ✓
            </span>
            With Baton
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {comparisonPoints.map((item) => (
              <div key={item.topic}>
                <div style={{ fontSize: 11, color: '#34d399', fontFamily: 'monospace', marginBottom: 4 }}>
                  {item.topic}
                </div>
                <div style={{ fontSize: 12, color: '#dbe0d8', lineHeight: 1.6 }}>
                  {item.with}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

