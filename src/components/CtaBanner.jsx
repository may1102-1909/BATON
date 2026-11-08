import React from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

export function CtaBanner({ onGetStarted, actionLabel = 'Get Started' }) {
  return (
    <section
      style={{
        margin: '60px 0 70px',
        padding: '54px 36px',
        borderRadius: 14,
        background: 'radial-gradient(ellipse at 50% 0%, #10b9811c, #111316 70%)',
        border: '1px solid #254436',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          color: '#34d399',
          fontSize: 10,
          letterSpacing: 1.8,
          fontFamily: 'monospace',
          marginBottom: 12,
          fontWeight: 600
        }}
      >
        START YOUR FIRST HANDOVER
      </div>

      <h2
        style={{
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: -1,
          margin: '0 auto 14px',
          maxWidth: 580,
          color: '#f4f4f5'
        }}
      >
        Move your team forward without losing the reasoning.
      </h2>

      <p
        style={{
          fontSize: 14,
          color: '#9ba0ab',
          maxWidth: 480,
          margin: '0 auto 28px',
          lineHeight: 1.8
        }}
      >
        Install the local MCP server, connect your coding agent, and generate cited handovers in minutes.
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          primary
          onClick={onGetStarted}
          style={{ padding: '13px 26px', fontSize: 13 }}
        >
          {actionLabel}
          <Icon size={15} />
        </Button>
      </div>

      <p
        style={{
          fontSize: 11,
          color: '#6e7480',
          marginTop: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}
      >
        <Icon name="shield" size={12} />
        No credit card required · Open-source local MCP server · Project-scoped
      </p>
    </section>
  )
}

