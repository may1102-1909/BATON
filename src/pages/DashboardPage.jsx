import React, { useEffect, useState } from 'react'
import { Workspace } from '../components/Workspace'
import { useRouter } from '../router'
import { supabase } from '../lib/supabase'

export function DashboardPage() {
  const { navigate } = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
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

  return (
    <Workspace
      user={user}
      onBack={() => navigate('/')}
      onSignOut={async () => {
        await supabase.auth.signOut()
        setUser(null)
        navigate('/')
      }}
    />
  )
}

export default DashboardPage
