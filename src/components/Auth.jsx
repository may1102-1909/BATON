import React, { useState, useEffect } from 'react'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { Button } from './Button'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

export function Auth({ mode: propMode = 'login', setMode: externalSetMode, back, onAuthSuccess }) {
  const [internalMode, setInternalMode] = useState(propMode || 'login')
  const mode = internalMode

  useEffect(() => {
    if (propMode) {
      setInternalMode(propMode)
      if (propMode === 'signup') {
        setUsePassword(true)
      }
    }
  }, [propMode])

  const handleModeChange = (m) => {
    setInternalMode(m)
    if (typeof externalSetMode === 'function') {
      try {
        externalSetMode(m)
      } catch (err) {
        console.warn('externalSetMode error:', err)
      }
    }
    if (m === 'signup') {
      setUsePassword(true)
    }
    setMessage('')
    setErrorMessage('')
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(propMode === 'signup')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState(isSupabaseConfigured ? '' : 'Baton is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY, then rebuild.')

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isEmailInvalid = (submitted || (touched && email.length > 0)) && !valid

  // 1. Sign Up Handler via Supabase
  const handleSignUp = async (emailToSubmit, passwordToSubmit) => {
    try {
      const redirectUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? `${window.location.origin}/usage`
          : 'https://baton-nu.vercel.app/usage'

      const { data, error } = await supabase.auth.signUp({
        email: emailToSubmit,
        password: passwordToSubmit,
        options: { emailRedirectTo: redirectUrl }
      })

      if (error) {
        console.error('Error signing up:', error.message)
        setErrorMessage(error.message)
      } else {
        console.log('User created:', data)
        setMessage('Account created successfully! Redirecting to usage...')
        if (onAuthSuccess) {
          onAuthSuccess(data?.user || { email: emailToSubmit })
        }
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            if (window.location.pathname.toLowerCase() !== '/usage') {
              window.location.href = '/usage'
            }
          }, 100)
        }
      }
    } catch (err) {
      console.error('Sign up failed:', err)
      setErrorMessage(err.message || 'Failed to create account.')
    }
  }

  // 2. Sign In Handler via Supabase
  const handleSignIn = async (emailToSubmit, passwordToSubmit) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToSubmit,
        password: passwordToSubmit
      })

      if (error) {
        console.error('Error signing in:', error.message)
        setErrorMessage(error.message)
      } else {
        console.log('Signed in successfully:', data.user)
        setMessage(`Signed in successfully as ${data.user.email}! Redirecting...`)
        if (onAuthSuccess) {
          onAuthSuccess(data?.user || { email: emailToSubmit })
        }
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            if (window.location.pathname.toLowerCase() !== '/usage') {
              window.location.href = '/usage'
            }
          }, 100)
        }
      }
    } catch (err) {
      console.error('Sign in failed:', err)
      setErrorMessage(err.message || 'Failed to sign in.')
    }
  }

  // 3. Magic Link Handler via Supabase
  const handleMagicLink = async (emailToSubmit) => {
    try {
      const redirectUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? `${window.location.origin}/usage`
          : 'https://baton-nu.vercel.app/usage'

      const { data, error } = await supabase.auth.signInWithOtp({
        email: emailToSubmit,
        options: { emailRedirectTo: redirectUrl }
      })

      if (error) {
        console.error('Error sending magic link:', error.message)
        setErrorMessage(error.message)
      } else {
        console.log('Magic link sent:', data)
        setMessage(`Magic link sent to ${emailToSubmit}. Please check your inbox.`)
      }
    } catch (err) {
      console.error('Magic link failed:', err)
      setErrorMessage(err.message || 'Failed to send magic link.')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    setTouched(true)
    setErrorMessage('')
    setMessage('')

    if (!valid) return
    if (usePassword && password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    setPending(true)
    try {
      if (usePassword) {
        if (mode === 'signup') {
          await handleSignUp(email, password)
        } else {
          await handleSignIn(email, password)
        }
      } else {
        await handleMagicLink(email)
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
                onClick={() => handleModeChange(m)}
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

          {/* GitHub button (kept as is) */}
          <Button
            style={{ width: '100%' }}
            onClick={async () => {
              try {
                const redirectUrl =
                  typeof window !== 'undefined' && window.location.hostname === 'localhost'
                    ? `${window.location.origin}/usage`
                    : 'https://baton-nu.vercel.app/usage'

                // Trigger Supabase GitHub OAuth
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'github',
                  options: { redirectTo: redirectUrl }
                })
                if (error) {
                  setMessage('GitHub authorization simulated. No account was connected.')
                }
              } catch {
                setMessage('GitHub authorization simulated. No account was connected.')
              }
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

          {/* Form */}
          <form onSubmit={submit} noValidate>
            {/* Quick auth method switcher */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setUsePassword(false)
                  setErrorMessage('')
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: `1px solid ${!usePassword ? '#34d39966' : C.line}`,
                  background: !usePassword ? '#10b98118' : '#0f1113',
                  color: !usePassword ? C.green : C.muted,
                  cursor: 'pointer',
                  fontWeight: !usePassword ? 600 : 400
                }}
              >
                Magic Link
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsePassword(true)
                  setErrorMessage('')
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: `1px solid ${usePassword ? '#34d39966' : C.line}`,
                  background: usePassword ? '#10b98118' : '#0f1113',
                  color: usePassword ? C.green : C.muted,
                  cursor: 'pointer',
                  fontWeight: usePassword ? 600 : 400
                }}
              >
                Password
              </button>
            </div>

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
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setMessage('')
                  setErrorMessage('')
                  if (submitted) setSubmitted(false)
                }}
                onBlur={() => setTouched(true)}
                aria-invalid={isEmailInvalid}
                aria-describedby={isEmailInvalid ? 'bt-email-error' : undefined}
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  background: '#0f1113',
                  border: `1px solid ${
                    isEmailInvalid ? '#b85d65' : C.line
                  }`,
                  borderRadius: 6,
                  padding: '13px 12px 13px 38px',
                  color: C.text,
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
            {isEmailInvalid && (
              <p
                id="bt-email-error"
                style={{ fontSize: 11, color: '#ef8585', margin: '6px 0 0' }}
              >
                Enter a valid email address.
              </p>
            )}

            {/* Password input right below email when usePassword is true */}
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
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setMessage('')
                      setErrorMessage('')
                    }}
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

          {/* Toggle between password & magic link */}
          <button
            className="bt-text"
            onClick={() => {
              setUsePassword(!usePassword)
              setMessage('')
              setErrorMessage('')
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

          {/* Success Status */}
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

          {/* Error Status */}
          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: 12,
                background: '#ef858514',
                color: '#ef8585',
                border: '1px solid #5a2828',
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.7,
                marginTop: 20
              }}
            >
              {errorMessage}
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
          CONNECTED TO SUPABASE AUTH
        </span>
      </div>
    </main>
  )
}
