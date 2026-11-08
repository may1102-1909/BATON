import React, { useState, useEffect } from 'react'
import { BatonLandingPage } from './components/BatonLandingPage'
import ClassicApp from './ClassicApp'

export default function App({ initialScreen = 'landing' }) {
  const [route, setRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase()
      if (hash.includes('classic')) return 'classic'
      if (hash.includes('auth')) return 'auth'
      return '3d-paper'
    }
    return initialScreen
  })

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.toLowerCase()
      if (hash.includes('classic')) {
        setRoute('classic')
      } else if (hash.includes('auth')) {
        setRoute('auth')
      } else {
        setRoute('3d-paper')
      }
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route === 'classic') {
    return <ClassicApp initialScreen="landing" />
  }

  return <BatonLandingPage initialTab={route} />
}
