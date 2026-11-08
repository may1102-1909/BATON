import React, { useState } from 'react'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { Button } from './Button'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

// Replace this adapter with Supabase Auth or NextAuth when connecting a backend.
const authAdapter = {
  magicLink: async (_email) => {
    await new Promise((r) => setTimeout(r, 600))
    return true
  },
  github: async () => {
    await new Promise((r) => setTimeout(r, 600))
    return true
  },
  password: async (_email, _password) => {
    await new Promise((r) => setTimeout(r, 600))
    return true
  }
}

export function Auth({ mode, setMode, back }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function submit(e) {
    e.preventDefault()
    setTouched(true)
    if (!valid || (usePassword && password.length < 8)) return
    setPending(true)
    try {
      if (usePassword) {
        await authAdapter.password(email, password)
        setMessage('Demo sign-in successful. No real account was created.')
      } else {
        await authAdapter.magicLink(email)
        setMessage(`Magic link simulated for ${email}. No email was sent.`)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 38%, #10b98112, transparent 55%)',
        padding: '32px 24px 80px'
      }}
    >
      <div className="bt-shell">
        <button
          className="bt-text"
          onClick={back}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            border: 0,
            background: 'none',
            color: C.muted,
            cursor: 'pointer',
            fontSize: 13,
            padding: '8px 0'
          }}
        >
          <Icon name="back" size={16} />
          Back to home
        </button>
      </div>

      <div
        style={{
          maxWidth: 410,
          margin: '50px auto 0',
          textAlign: 'center'
        }}
      >
        <Brand size={26} />
        <h1
          style={{
            fontSize: 28,
            letterSpacing: -1,
            margin: '32px 0 10px',
            fontWeight: 600
          }}
        >
          {mode === 'signup'
            ? 'Your next handover starts here.'
            : 'Welcome back.'}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: C.muted,
            marginBottom: 28,
            lineHeight: 1.6
          }}
        >
          Keep the context. Move your team forward.
        </p>

        <div
          style={{
            background: '#141619',
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: 28,
            textAlign: 'left',
            boxShadow: '0 20px 80px #00000040'
          }}
        >
          {/* Tab selector */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            style={{
              display: 'flex',
              borderBottom: `1px solid ${C.line}`,
              marginBottom: 26
            }}
          >
            {[
              ['login', 'Sign In'],
              ['signup', 'Create Account']
            ].map(([m, label]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setMessage('')
                }}
                style={{
                  flex: 1,
                  padding: '0 0 14px',
                  background: 'none',
                  border: 0,
                  borderBottom:
                    mode === m ? '2px solid #34d399' : '2px solid transparent',
                  color: mode === m ? C.text : C.muted,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: mode === m ? 600 : 400
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* GitHub button */}
          <Button
            style={{ width: '100%' }}
            onClick={async () => {
              await authAdapter.github()
              setMessage('GitHub authorization simulated. No account was connected.')
            }}
          >
            <Icon name="github" />
            Continue with GitHub
          </Button>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              fontSize: 10,
              color: '#757984',
              margin: '24px 0'
            }}
          >
            <span style={{ height: 1, background: C.line, flex: 1 }} />
            or continue with email
            <span style={{ height: 1, background: C.line, flex: 1 }} />
          </div>

          {/* Email form */}
          <form onSubmit={submit} noValidate>
            <label
              htmlFor="baton-email"
              style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
            >
              Email address
            </label>
            <div style={{ position: 'relative', color: '#717781' }}>
              <span style={{ position: 'absolute', left: 12, top: 13 }}>
                <Icon name="mail" size={16} />
              </span>
              <input
                id="baton-email"
                autoFocus
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setMessage('')
                }}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !valid}
                aria-describedby={touched && !valid ? 'bt-email-error' : undefined}
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  background: '#0f1113',
                  border: `1px solid ${
                    touched && !valid ? '#b85d65' : C.line
                  }`,
                  borderRadius: 6,
                  padding: '13px 12px 13px 38px',
                  color: C.text,
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
            {touched && !valid && (
              <p
                id="bt-email-error"
                style={{ fontSize: 11, color: '#ef8585', margin: '6px 0 0' }}
              >
                Enter a valid work email address.
              </p>
            )}

            {usePassword && (
              <div style={{ marginTop: 18 }}>
                <label
                  htmlFor="baton-password"
                  style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                >
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="baton-password"
                    type={show ? 'text' : 'password'}
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    style={{
                      width: '100%',
                      padding: '13px 42px 13px 12px',
                      background: '#0f1113',
                      border: `1px solid ${C.line}`,
                      borderRadius: 6,
                      color: C.text,
                      outline: 'none',
                      fontSize: 13
                    }}
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow(!show)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: 11,
                      background: 'none',
                      border: 0,
                      color: C.muted,
                      cursor: 'pointer'
                    }}
                  >
                    <Icon name="eye" />
                  </button>
                </div>
                <p
                  style={{
                    fontSize: 10,
                    color:
                      password.length > 0 && password.length < 8
                        ? '#ef8585'
                        : C.muted,
                    margin: '6px 0 0'
                  }}
                >
                  Minimum 8 characters
                </p>
              </div>
            )}

            <Button
              primary
              type="submit"
              disabled={
                pending || !valid || (usePassword && password.length < 8)
              }
              style={{ width: '100%', marginTop: 18 }}
            >
              {pending
                ? 'Please wait…'
                : usePassword
                ? mode === 'signup'
                  ? 'Create Account'
                  : 'Sign In'
                : 'Send Magic Link'}
              <Icon size={15} />
            </Button>
          </form>

          <button
            className="bt-text"
            onClick={() => {
              setUsePassword(!usePassword)
              setMessage('')
            }}
            aria-expanded={usePassword}
            style={{
              display: 'block',
              margin: '20px auto 0',
              background: 'none',
              border: 0,
              color: C.muted,
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            {usePassword ? 'Use magic link instead' : 'Use password instead'}
          </button>

          {message && (
            <div
              role="status"
              style={{
                padding: 12,
                background: '#10b98112',
                color: C.green,
                border: '1px solid #245541',
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.7,
                marginTop: 20
              }}
            >
              {message}
            </div>
          )}
        </div>

        <p
          style={{
            fontSize: 10,
            color: '#71747d',
            lineHeight: 1.9,
            margin: '22px 18px'
          }}
        >
          By signing in, you agree to project-scoped memory indexing. Baton never
          captures personal machine activity.
        </p>

        <span
          style={{
            fontSize: 10,
            color: '#565c65',
            letterSpacing: 0.8,
            fontFamily: 'monospace'
          }}
        >
          DEMO ENVIRONMENT · NO REAL AUTHENTICATION
        </span>
      </div>
    </main>
  )
}

