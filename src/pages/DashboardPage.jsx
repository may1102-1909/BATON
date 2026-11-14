import React, { useEffect, useState } from 'react'
import { Workspace } from '../components/Workspace'
import { useRouter } from '../router'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { acceptPendingInvite, getPendingInvite } from '../lib/invite'

export function DashboardPage() {
  const { navigate } = useRouter()
  const [user, setUser] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [inviteState, setInviteState] = useState(() => (getPendingInvite() ? { status: 'pending' } : { status: 'none' }))

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setSessionChecked(true)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Signed-out visitors cannot use the dashboard: send them to sign in.
  useEffect(() => {
    if (isSupabaseConfigured && sessionChecked && !user) navigate('/auth', { replace: true })
  }, [sessionChecked, user])

  // A pending invite is accepted before the workspace loads the user's teams.
  useEffect(() => {
    if (!user || inviteState.status !== 'pending') return
    let cancelled = false
    acceptPendingInvite().then(result => {
      if (!cancelled) setInviteState(result)
    })
    return () => { cancelled = true }
  }, [user, inviteState.status])

  if (!isSupabaseConfigured) {
    return (
      <main id="main" role="alert" style={{ maxWidth: 520, margin: '20vh auto', padding: 24, textAlign: 'center', fontFamily: 'inherit' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Baton is not configured</h1>
        <p>Set SUPABASE_URL and SUPABASE_ANON_KEY (or their VITE_ equivalents), then rebuild.</p>
        <button type="button" onClick={() => navigate('/')}>Back</button>
      </main>
    )
  }

  if (!sessionChecked || !user || inviteState.status === 'pending') {
    return (
      <main id="main" role="status" style={{ maxWidth: 520, margin: '20vh auto', padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
        <h1 className="sr-only">Baton dashboard</h1>
        {inviteState.status === 'pending' ? 'Joining your team…' : 'Loading your workspace…'}
      </main>
    )
  }

  return (
    <Workspace
      user={user}
      inviteResult={inviteState}
      onBack={() => navigate('/usage')}
      onSignOut={async () => {
        await supabase.auth.signOut()
        setUser(null)
        navigate('/')
      }}
    />
  )
}

export default DashboardPage
