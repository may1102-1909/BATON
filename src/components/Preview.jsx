import React from 'react'
import { Icon } from './Icon'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

const claims = [
  {
    status: 'Verified',
    color: '#34d399',
    title: 'Auth migrated from Firebase to Supabase due to tier limits',
    tag: 'PR #42',
    file: 'auth/migration.md',
    snippet:
      'Decision: migrate authentication to Supabase. Firebase tier limits blocked team growth. Approved in PR #42 by Rahul S.'
  },
  {
    status: 'Inferred',
    color: '#e8b86d',
    title: 'Payment webhook incomplete (stale branch detected)',
    tag: 'branch feat/pay',
    file: 'api/webhooks/payment.ts',
    snippet:
      'TODO: verify webhook signature and add retry handling. Branch feat/pay has not been merged; implementation status is inferred from the latest commit.'
  },
  {
    status: 'Conflicting',
    color: '#ef8585',
    title: 'Deployment deadline mismatch: Nov 10 vs Nov 15',
    tag: 'Task #7',
    file: 'tasks/release-plan.md',
    snippet:
      'Task #7 lists Nov 10. The release planning note lists Nov 15. Both sources are preserved for the incoming engineer to resolve.'
  }
]

export function Preview({ expanded, setExpanded }) {
  return (
    <div
      id="bt-demo"
      style={{
        scrollMarginTop: 100,
        position: 'relative',
        border: '1px solid #34373a',
        borderRadius: 12,
        background: 'linear-gradient(140deg, #1b1d20, #131416)',
        boxShadow: '0 0 80px #10b9810b, 0 24px 70px #00000066',
        overflow: 'hidden'
      }}
    >
      {/* Code window title bar */}
      <div
        style={{
          padding: '15px 20px',
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#85888e',
          fontFamily: 'monospace'
        }}
      >
        <span style={{ display: 'flex', gap: 6 }}>
          {['#5b5d64', '#42454a', '#34373c'].map((c) => (
            <i
              key={c}
              style={{
                width: 7,
                height: 7,
                background: c,
                borderRadius: 20,
                display: 'inline-block'
              }}
            />
          ))}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          baton / handover.inspect <Icon name="code" size={13} />
        </span>
      </div>

      {/* Handover preview header */}
      <div
        style={{
          padding: '24px 22px 20px',
          borderBottom: `1px solid ${C.line}`
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'center',
            marginBottom: 18
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: C.green,
              letterSpacing: 1.5,
              fontFamily: 'monospace',
              fontWeight: 600
            }}
          >
            HANDOVER PREVIEW
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '4px 7px',
              border: '1px solid #25513f',
              borderRadius: 4,
              color: '#6ee7b7',
              background: '#10b9810c'
            }}
          >
            Approved v3
          </span>
        </div>

        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          Rahul S.{' '}
          <span style={{ color: '#62666e', display: 'flex' }}>
            <Icon size={17} />
          </span>{' '}
          Priya M.
        </div>

        <div style={{ fontSize: 11, color: '#92959e', marginTop: 7 }}>
          Backend role{' '}
          <span style={{ color: '#45484f', margin: '0 7px' }}>/</span> Project:
          core-platform
        </div>
      </div>

      {/* Claims List */}
      <div style={{ padding: '4px 20px' }}>
        {claims.map((c, i) => (
          <div
            key={c.status}
            style={{
              borderBottom: i < 2 ? `1px solid ${C.line}` : undefined,
              padding: '18px 0'
            }}
          >
            <button
              className="bt-claim"
              aria-expanded={expanded === i}
              onClick={() => setExpanded(expanded === i ? -1 : i)}
              style={{
                textAlign: 'left',
                background: 'transparent',
                border: 0,
                color: C.text,
                padding: 0,
                width: '100%',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10,
                    color: c.color,
                    background: `${c.color}12`,
                    border: `1px solid ${c.color}27`,
                    padding: '3px 6px',
                    borderRadius: 4,
                    fontWeight: 500
                  }}
                >
                  {i === 0 ? (
                    <Icon name="check" size={11} />
                  ) : (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 9,
                        background: c.color
                      }}
                    />
                  )}
                  {c.status}
                </span>
                <span
                  style={{
                    transform: expanded === i ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s ease',
                    display: 'inline-flex',
                    color: '#85888e'
                  }}
                >
                  <Icon name="chevron" size={12} />
                </span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 350 }}>
                {c.title}
              </div>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 10,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#9fa3ad',
                  background: '#23252a',
                  padding: '4px 7px',
                  border: '1px solid #303238',
                  borderRadius: 4
                }}
              >
                {c.tag}
              </span>
            </button>

            {expanded === i && (
              <div
                style={{
                  padding: 12,
                  marginTop: 12,
                  background: '#0c1010',
                  border: '1px solid #274033',
                  borderRadius: 5,
                  fontSize: 11,
                  lineHeight: 1.8,
                  color: '#a7b6ae',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div
                  style={{
                    color: C.green,
                    fontFamily: 'monospace',
                    marginBottom: 5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Icon name="code" size={12} />
                  {c.file}
                </div>
                {c.snippet}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div
        style={{
          padding: '14px 20px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          fontSize: 9,
          color: '#868992',
          background: '#101113',
          borderTop: `1px solid ${C.line}`
        }}
      >
        <Icon name="lock" size={11} />
        <span>3 secrets redacted</span>
        <span style={{ margin: '0 3px' }}>·</span>
        <span>2 items hidden for role clearance</span>
      </div>
    </div>
  )
}
