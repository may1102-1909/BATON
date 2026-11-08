import React, { useState, useRef } from 'react'
import { Brand } from './components/Brand'
import { Icon } from './components/Icon'
import { Button } from './components/Button'
import { Preview } from './components/Preview'
import { Auth } from './components/Auth'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

export default function App({
  initialScreen = 'landing',
  headline = 'Pass the knowledge, not just the code.'
}) {
  const [view, setView] = useState(initialScreen)
  const [mode, setMode] = useState('login')
  const [expanded, setExpanded] = useState(-1)

  const demoRef = useRef(null)
  const featuresRef = useRef(null)
  const architectureRef = useRef(null)
  const docsRef = useRef(null)

  function auth(m = 'signup') {
    setMode(m)
    setView('auth')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scroll(ref) {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (view === 'auth') {
    return <Auth mode={mode} setMode={setMode} back={() => setView('landing')} />
  }

  const headlineParts = headline.split('not just')

  return (
    <div
      className="baton-app"
      style={{
        width: '100%',
        minHeight: '100vh',
        background: C.bg,
        color: C.text
      }}
    >
      {/* Sticky Navigation Bar */}
      <header
        className="bt-nav"
        style={{
          borderBottom: `1px solid ${C.line}`,
          background: '#0c0d0ee6'
        }}
      >
        <div
          className="bt-shell"
          style={{
            height: 76,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Brand />
            <span
              className="bt-round"
              style={{
                fontSize: 9,
                color: '#93979f',
                padding: '5px 7px',
                border: '1px solid #303238',
                borderRadius: 4,
                letterSpacing: 0.3
              }}
            >
              Hackathon Build · Round 2
            </span>
          </div>

          <nav className="bt-navlinks" aria-label="Main navigation">
            {[
              ['Features', featuresRef],
              ['Architecture', architectureRef],
              ['Live Demo', demoRef],
              ['Docs', docsRef]
            ].map(([label, ref]) => (
              <button
                key={label}
                className="bt-text"
                onClick={() => scroll(ref)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.muted,
                  border: 0,
                  padding: 0,
                  background: 'none',
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: 17, alignItems: 'center' }}>
            <button
              className="bt-text bt-signin"
              onClick={() => auth('login')}
              style={{
                fontSize: 12,
                fontWeight: 500,
                border: 0,
                background: 'none',
                color: C.text,
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <Button
              primary
              onClick={() => auth('signup')}
              style={{ padding: '9px 15px', fontSize: 12 }}
            >
              Get Started
              <Icon size={13} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="bt-shell">
          {/* Hero Section */}
          <section className="bt-hero">
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  color: '#b3b9b5',
                  border: '1px solid #284435',
                  background: '#10b98108',
                  borderRadius: 30,
                  padding: '6px 12px',
                  fontWeight: 500
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: C.green,
                    borderRadius: 10,
                    boxShadow: '0 0 8px #34d39966',
                    display: 'inline-block'
                  }}
                />
                Built for the next engineer.
              </span>

              <h1 className="bt-title">
                {headlineParts[0]}
                <span style={{ color: C.green }}>
                  not just{headlineParts[1]}
                </span>
              </h1>

              <p
                style={{
                  fontSize: 14,
                  color: C.muted,
                  lineHeight: 1.85,
                  maxWidth: 440,
                  margin: '0 0 26px'
                }}
              >
                When engineers leave, the code stays but the reasoning
                disappears. Baton captures architectural decisions directly from
                your AI coding agents and git history, generating cited,
                secret-redacted, role-based handovers before anyone walks out the
                door.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button primary onClick={() => auth('signup')}>
                  Get Started
                  <Icon size={16} />
                </Button>
                <Button
                  onClick={() => {
                    setExpanded(0)
                    scroll(demoRef)
                  }}
                >
                  View Live Demo
                  <Icon name="external" size={14} />
                </Button>
              </div>

              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#747982',
                  marginTop: 22
                }}
              >
                <Icon name="shield" size={12} />
                Project-scoped. Secret-redacted. Always cited.
              </p>
            </div>

            {/* Interactive Handover Card Demo */}
            <div ref={demoRef}>
              <Preview expanded={expanded} setExpanded={setExpanded} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  color: '#69716f',
                  fontSize: 9,
                  marginTop: 15,
                  fontFamily: 'monospace',
                  letterSpacing: 0.5
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    background: C.green,
                    borderRadius: 10,
                    display: 'inline-block'
                  }}
                />
                REAL CONTEXT. TRACEABLE SOURCES. ZERO GUESSWORK.
              </div>
            </div>
          </section>

          {/* Context Line / Trust Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 20,
              padding: '24px 0',
              borderTop: `1px solid ${C.line}`,
              borderBottom: `1px solid ${C.line}`,
              fontSize: 10,
              color: '#6e727b',
              flexWrap: 'wrap',
              letterSpacing: 0.5
            }}
          >
            <span>CONTEXT IN. CONFIDENCE OUT.</span>
            <span style={{ color: '#a2a6ae' }}>
              AI coding agents{' '}
              <span style={{ margin: '0 14px', color: '#373b41' }}>/</span> Git
              history{' '}
              <span style={{ margin: '0 14px', color: '#373b41' }}>/</span> Human
              decisions
            </span>
          </div>

          {/* Features Section */}
          <section
            ref={featuresRef}
            style={{ padding: '64px 0', scrollMarginTop: 90 }}
          >
            <div
              style={{
                color: C.green,
                fontSize: 10,
                letterSpacing: 1.7,
                fontFamily: 'monospace',
                marginBottom: 12,
                fontWeight: 600
              }}
            >
              BUILT FOR CONTINUITY
            </div>
            <h2
              style={{
                fontSize: 31,
                fontWeight: 500,
                letterSpacing: -1.2,
                margin: '0 0 10px'
              }}
            >
              A handover. Not a guessing game.
            </h2>
            <p
              style={{
                fontSize: 13,
                color: C.muted,
                margin: '0 0 30px',
                lineHeight: 1.8
              }}
            >
              Everything your next engineer needs. Nothing they shouldn’t see.
            </p>

            <div
              className="bt-grid"
              style={{
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                overflow: 'hidden'
              }}
            >
              {[
                {
                  icon: 'git',
                  title: 'Every claim has a source.',
                  body: 'Trace decisions back to the pull request, commit, or conversation that made them.',
                  note: 'Evidence over assumptions'
                },
                {
                  icon: 'lock',
                  title: 'Context without the risk.',
                  body: 'Secrets are redacted before handover. Role-based clearance keeps sensitive context scoped.',
                  note: 'Private by design'
                },
                {
                  icon: 'shield',
                  title: 'Know what you can trust.',
                  body: 'Verified, inferred, and conflicting claims stay distinct. Uncertainty is visible, not buried.',
                  note: 'Confidence, made explicit'
                }
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="bt-card"
                  style={{
                    padding: 26,
                    background: '#111315',
                    borderRight: i < 2 ? `1px solid ${C.line}` : undefined
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      color: C.green,
                      background: '#10b9810a',
                      padding: 9,
                      border: '1px solid #294136',
                      borderRadius: 7
                    }}
                  >
                    <Icon name={f.icon} size={18} />
                  </span>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      margin: '22px 0 10px'
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.8,
                      color: C.muted,
                      margin: '0 0 25px'
                    }}
                  >
                    {f.body}
                  </p>
                  <span
                    style={{
                      fontSize: 9,
                      color: '#6f7975',
                      fontFamily: 'monospace'
                    }}
                  >
                    {f.note}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Architecture / Pipeline Section */}
          <section
            ref={architectureRef}
            style={{ padding: '20px 0 64px', scrollMarginTop: 100 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 26
              }}
            >
              <h2
                style={{
                  fontSize: 23,
                  fontWeight: 500,
                  letterSpacing: -0.7,
                  margin: 0
                }}
              >
                From scattered context to shared clarity.
              </h2>
            </div>
            <div
              className="bt-steps"
              style={{
                padding: 26,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                background: '#101214'
              }}
            >
              {[
                'Capture agent & git context',
                'Cite, redact & check claims',
                'Deliver a role-based handover'
              ].map((text, i) => (
                <React.Fragment key={text}>
                  {i > 0 && <Icon size={15} style={{ color: '#45484f' }} />}
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      fontSize: 12,
                      color: '#b4b8bf',
                      fontWeight: 500
                    }}
                  >
                    <span
                      style={{
                        color: C.green,
                        fontFamily: 'monospace',
                        fontSize: 11
                      }}
                    >
                      0{i + 1}
                    </span>
                    {text}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Developer Notes / Docs Section */}
          <section
            ref={docsRef}
            style={{ padding: '0 0 55px', scrollMarginTop: 100 }}
          >
            <details
              style={{
                borderTop: `1px solid ${C.line}`,
                paddingTop: 22
              }}
            >
              <summary
                style={{
                  fontSize: 12,
                  cursor: 'pointer',
                  color: '#a3a8af',
                  fontWeight: 500,
                  userSelect: 'none'
                }}
              >
                Developer notes · How this demo works
              </summary>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.9,
                  color: C.muted,
                  maxWidth: 700,
                  marginTop: 12
                }}
              >
                Explore the handover by selecting any claim or source tag. The
                citations are illustrative sample data. Authentication is
                simulated locally: GitHub never connects, magic links are not
                sent, and no personal data is stored. Production integration
                requires connecting an authentication provider and project-scoped
                sources.
              </p>
            </details>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.line}` }}>
        <div
          className="bt-shell bt-bottom"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 26,
            paddingBottom: 26
          }}
        >
          <Brand size={20} />
          <span style={{ fontSize: 11, color: '#747881' }}>
            Pass the knowledge. Keep the momentum.
          </span>
          <span style={{ fontSize: 10, color: '#555b64', fontFamily: 'monospace' }}>
            © 2026 BATON · Hackathon Build
          </span>
        </div>
      </footer>
    </div>
  )
}
