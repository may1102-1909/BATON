import React, { useEffect, useState } from 'react'
import { Workspace } from '../components/Workspace'
import { useRouter } from '../router'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export function DashboardPage() {
  const { navigate } = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div role="alert" style={{ maxWidth: 520, margin: '20vh auto', padding: 24, textAlign: 'center', fontFamily: 'inherit' }}>
        <h2>Baton is not configured</h2>
        <p>Set SUPABASE_URL and SUPABASE_ANON_KEY (or their VITE_ equivalents), then rebuild.</p>
        <button type="button" onClick={() => navigate('/')}>Back</button>
      </div>
    )
  }

  return (
    <Workspace
      user={user}
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
