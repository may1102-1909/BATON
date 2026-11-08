import React, { useState, useRef, useEffect } from 'react'
import { Brand } from './components/Brand'
import { Icon } from './components/Icon'
import { Button } from './components/Button'
import { Auth } from './components/Auth'
import { Dashboard } from './components/Dashboard'
import { TerminalDemo } from './components/TerminalDemo'
import { Comparison } from './components/Comparison'
import { CtaBanner } from './components/CtaBanner'
import { supabase } from './lib/supabase'
import { useRouter } from './router'

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
  headline = 'Pass the knowledge, not just the code.',
  primaryActionLabel = 'Get Started',
  onPrimaryAction = null
}) {
  const { navigate } = useRouter()
  // Support deep-linking to /dashboard or /auth based on pathname
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
      return 'dashboard'
    }
    if (typeof window !== 'undefined' && window.location.pathname === '/auth') {
      return 'auth'
    }
    return initialScreen
  })
  const [mode, setMode] = useState('login')
  const [currentUser, setCurrentUser] = useState(null)

  const featuresRef = useRef(null)
  const workflowRef = useRef(null)
  const architectureRef = useRef(null)
  const docsRef = useRef(null)

  useEffect(() => {
    // 1. Get initial active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user)
      }
    })

    // 2. Listen to authentication state changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null)
    })

    // 3. Listen to browser popstate (back/forward)
    const handlePopState = () => {
      if (window.location.pathname === '/dashboard') {
        setView('dashboard')
      } else if (window.location.pathname === '/auth') {
        setView('auth')
      } else {
        setView('landing')
      }
    }
    window.addEventListener('popstate', handlePopState)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  function auth(m = 'signup') {
    setMode(m)
    setView('auth')
    navigate('/auth')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function navigateTo(path, targetView) {
    if (path === '/' || path === '/landing') {
      navigate('/')
      return
    }
    if (path === '/dashboard') {
      navigate('/dashboard')
      return
    }
    if (path === '/review') {
      navigate('/review')
      return
    }
    if (path === '/tasks') {
      navigate('/tasks')
      return
    }
    navigate(path)
    setView(targetView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setCurrentUser(null)
    navigateTo('/', 'landing')
  }

  function scroll(ref) {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // View: Auth Screen
  if (view === 'auth') {
    return (
      <Auth
        mode={mode}
        setMode={setMode}
        back={() => navigateTo('/', 'landing')}
        onAuthSuccess={(user) => {
          setCurrentUser(user)
          // Land on /dashboard immediately after signin / create account
          navigateTo('/dashboard', 'dashboard')
        }}
      />
    )
  }

  // View: Dashboard Screen
  if (view === 'dashboard') {
    return (
      <Dashboard
        user={currentUser}
        onBack={() => navigateTo('/', 'landing')}
        onSignOut={handleSignOut}
      />
    )
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
            <button
              onClick={() => navigateTo('/', 'landing')}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Return to 3D Paper"
            >
              <Brand />
            </button>
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
            <button
              className="bt-text"
              onClick={() => navigateTo('/', 'landing')}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.green,
                border: 0,
                padding: 0,
                background: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Icon name="back" size={12} />
              3D Paper
            </button>
            <button
              className="bt-text"
              onClick={() => navigateTo('/dashboard', 'dashboard')}
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
              Dashboard
            </button>
            {[
              ['Features', featuresRef],
              ['Workflow', workflowRef],
              ['Architecture', architectureRef],
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
            {currentUser ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Button
                  primary
                  onClick={() => navigateTo('/dashboard', 'dashboard')}
                  style={{ padding: '7px 14px', fontSize: 11 }}
                >
                  Dashboard
                  <Icon size={13} />
                </Button>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: C.green,
                    background: '#10b98118',
                    border: '1px solid #284435',
                    padding: '4px 10px',
                    borderRadius: 20
                  }}
                >
                  {currentUser.email}
                </span>
                <button
                  className="bt-text"
                  onClick={handleSignOut}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    border: 0,
                    background: 'none',
                    color: C.muted,
                    cursor: 'pointer'
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
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
                  onClick={onPrimaryAction || (() => auth('signup'))}
                  style={{ padding: '9px 15px', fontSize: 12 }}
                >
                  {primaryActionLabel}
                  <Icon size={13} />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="bt-shell">
          {/* Hero Section */}
          <section className="bt-hero">
            <div
              style={{
                maxWidth: 780,
                margin: '0 auto',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#b3b9b5',
                  border: '1px solid #284435',
                  background: '#10b98108',
                  borderRadius: 30,
                  padding: '6px 14px',
                  fontWeight: 500,
                  marginBottom: 10
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
                  fontSize: 16,
                  color: C.muted,
                  lineHeight: 1.85,
                  maxWidth: 580,
                  margin: '0 auto 30px'
                }}
              >
                When engineers leave, the code stays but the reasoning
                disappears. Baton captures architectural decisions directly from
                your AI coding agents and git history, generating cited,
                secret-redacted, role-based handovers before anyone walks out the
                door.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                  justifyContent: 'center'
                }}
              >
                <Button
                  primary
                  onClick={onPrimaryAction || (() => auth('signup'))}
                  style={{ padding: '14px 26px', fontSize: 14 }}
                >
                  {primaryActionLabel}
                  <Icon size={16} />
                </Button>
                <Button
                  onClick={() => scroll(workflowRef)}
                  style={{ padding: '14px 24px', fontSize: 14 }}
                >
                  View Workflow
                  <Icon size={16} />
                </Button>
              </div>

              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#747982',
                  marginTop: 26
                }}
              >
                <Icon name="shield" size={12} />
                Project-scoped. Secret-redacted. Always cited.
              </p>
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

          {/* Developer Workflow Terminal Demo */}
          <div ref={workflowRef}>
            <TerminalDemo />
          </div>

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

          {/* Before & After Comparison */}
          <Comparison />

          {/* Call to Action Banner */}
          <CtaBanner
            onGetStarted={onPrimaryAction || (() => auth('signup'))}
            actionLabel={primaryActionLabel}
          />

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
                Developer notes · How this works
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
                Baton captures architectural decisions and citations from pull
                requests, commit traces, and agent conversation context.
                Authentication is simulated locally: GitHub never connects,
                magic links are not sent, and no personal data is stored.
                Production integration requires connecting an authentication
                provider and project-scoped sources.
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
          <span
            style={{
              fontSize: 10,
              color: '#555b64',
              fontFamily: 'monospace'
            }}
          >
            © 2026 BATON · Hackathon Build
          </span>
        </div>
      </footer>
    </div>
  )
}
