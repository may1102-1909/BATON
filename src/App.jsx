import React from 'react'
import { RouterProvider, useRouter } from './router'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { ReviewPage } from './pages/ReviewPage'
import { TasksPage } from './pages/TasksPage'
import { UsagePage } from './pages/UsagePage'
import { Auth } from './components/Auth'
import ClassicApp from './ClassicApp'
import HandoverReviewPage from '../app/handover/[id]/page'

function AuthPageWrapper() {
  const { path, navigate } = useRouter()
  const cleanPath = path.split('?')[0].toLowerCase()
  const isSignup = path.includes('mode=signup') || cleanPath === '/signup'
  const [mode, setMode] = React.useState(isSignup ? 'signup' : 'login')

  return (
    <Auth
      mode={mode}
      setMode={setMode}
      back={() => navigate('/')}
      onAuthSuccess={() => navigate('/usage')}
    />
  )
}

function AppRoutes() {
  const { path, navigate } = useRouter()
  const cleanPath = path.split('?')[0].toLowerCase()

  // Query parameters parsing
  const isSignup = path.includes('mode=signup') || cleanPath === '/signup'
  const isLogin = path.includes('mode=login') || cleanPath === '/login'

  if (cleanPath.startsWith('/dashboard/handover')) {
    const id = cleanPath.replace(/^\/dashboard\/handover\/?/, '') || 'active'
    return <HandoverReviewPage params={{ id }} />
  }

  if (cleanPath.startsWith('/handover')) {
    const id = cleanPath.replace(/^\/handover\/?/, '') || 'active'
    return <HandoverReviewPage params={{ id }} />
  }

  if (cleanPath === '/dashboard') {
    return <DashboardPage />
  }

  if (cleanPath === '/usage' || cleanPath === '/usgae') {
    return <UsagePage />
  }

  if (cleanPath === '/review' || cleanPath === '/inspect') {
    return <ReviewPage />
  }

  if (cleanPath === '/tasks' || cleanPath === '/claims') {
    return <TasksPage />
  }

  if (cleanPath === '/auth' || isLogin || isSignup) {
    return <AuthPageWrapper />
  }

  if (cleanPath === '/classic') {
    return <ClassicApp initialScreen="landing" />
  }

  // Root URL ('/' or '/landing') is the dedicated standalone 3D Paper Landing Page
  return <LandingPage />
}

export default function App() {
  return (
    <RouterProvider>
      <AppRoutes />
    </RouterProvider>
  )
}
