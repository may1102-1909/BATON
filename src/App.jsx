import React, { useEffect } from 'react'
import { RouterProvider, useRouter } from './router'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsagePage } from './pages/UsagePage'
import { DemoPage } from './pages/DemoPage'
import { Auth } from './components/Auth'
import { HandoverPage } from './pages/HandoverPage'
import { captureInviteFromUrl } from './lib/invite'
import { supabase, isSupabaseConfigured } from './lib/supabase'

// Retired static screens; everything now lives in the real dashboard.
const LEGACY_PATHS = new Set(['/review', '/inspect', '/tasks', '/claims', '/classic'])

function Redirect({ to }) {
  const { navigate } = useRouter()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])
  return null
}

function AuthPageWrapper() {
  const { path, navigate } = useRouter()
  const cleanPath = path.split('?')[0].toLowerCase()
  const isSignup = path.includes('mode=signup') || cleanPath === '/signup'
  const [mode, setMode] = React.useState(isSignup ? 'signup' : 'login')
  const [hasInvite] = React.useState(() => Boolean(captureInviteFromUrl()))

  // A visitor who is already signed in goes straight to the dashboard, where a pending invite is accepted.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) navigate('/dashboard', { replace: true })
    }).catch(() => {})
  }, [])

  return (
    <Auth
      mode={mode}
      setMode={setMode}
      hasInvite={hasInvite}
      back={() => navigate('/')}
      onAuthSuccess={() => navigate('/dashboard')}
    />
  )
}

function AppRoutes() {
  const { path, navigate } = useRouter()
  const cleanPath = path.split('?')[0].toLowerCase()

  // Query parameters parsing
  const isSignup = path.includes('mode=signup') || cleanPath === '/signup'
  const isLogin = path.includes('mode=login') || cleanPath === '/login'

  const packet = /^\/(?:dashboard\/)?handover\/([^/]+)\/?$/i.exec(path.split('?')[0])
  if (packet) {
    return <HandoverPage handoverId={decodeURIComponent(packet[1])} onBack={() => navigate('/dashboard')} />
  }

  if (cleanPath === '/dashboard') {
    return <DashboardPage />
  }

  if (cleanPath === '/demo-page' || cleanPath.startsWith('/demo-page')) {
    return <DemoPage />
  }

  if (cleanPath === '/usage' || cleanPath === '/usgae') {
    return <UsagePage />
  }

  if (LEGACY_PATHS.has(cleanPath)) {
    return <Redirect to="/dashboard" />
  }

  if (cleanPath === '/auth' || isLogin || isSignup) {
    return <AuthPageWrapper />
  }

  // Root URL ('/' or '/landing') is the dedicated standalone 3D Paper Landing Page
  return <LandingPage />
}

export default function App() {
  React.useState(captureInviteFromUrl)
  return (
    <RouterProvider>
      <AppRoutes />
    </RouterProvider>
  )
}
