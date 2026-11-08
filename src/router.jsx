import React, { createContext, useContext, useState, useEffect } from 'react'

const RouterContext = createContext({
  path: '/',
  navigate: () => {}
})

export function RouterProvider({ children }) {
  const [path, setPath] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase()
      const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
      if (h) return '/' + h
      return p || '/'
    }
    return '/'
  })

  useEffect(() => {
    function updatePath() {
      const p = window.location.pathname.toLowerCase()
      const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
      setPath(h ? '/' + h : (p || '/'))
    }

    window.addEventListener('popstate', updatePath)
    window.addEventListener('hashchange', updatePath)

    // Intercept pushState & replaceState so URL changes anywhere trigger re-renders
    const origPush = window.history.pushState
    const origReplace = window.history.replaceState

    window.history.pushState = function (...args) {
      const res = origPush.apply(this, args)
      updatePath()
      return res
    }
    window.history.replaceState = function (...args) {
      const res = origReplace.apply(this, args)
      updatePath()
      return res
    }

    return () => {
      window.removeEventListener('popstate', updatePath)
      window.removeEventListener('hashchange', updatePath)
      window.history.pushState = origPush
      window.history.replaceState = origReplace
    }
  }, [])

  function navigate(to) {
    if (typeof window === 'undefined') return
    const normalized = to.startsWith('/') ? to : '/' + to
    if (window.location.pathname !== normalized) {
      window.history.pushState({}, '', normalized)
      setPath(normalized)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setPath(normalized)
    }
  }

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  return useContext(RouterContext)
}

export function Link({ to, href, children, className = '', style, onClick, ...props }) {
  const { navigate } = useRouter()
  const target = to || href || '/'

  function handleClick(e) {
    // Let browser handle modifier keys (Cmd/Ctrl + click for new tab)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (onClick) onClick(e)
    navigate(target)
  }

  return (
    <a
      href={target}
      onClick={handleClick}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </a>
  )
}
