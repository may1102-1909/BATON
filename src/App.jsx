import React from 'react'
import {RouterProvider,useRouter} from './router'
import {LandingPage} from './pages/LandingPage'
import {Auth} from './components/Auth'
import Workspace from './components/Workspace'

function AppRoutes() {
  const {path,navigate}=useRouter()
  const route=path.split('?')[0].toLowerCase()
  if (['/auth','/login','/signup'].includes(route)) {
    const signup=route==='/signup' || new URLSearchParams(window.location.search).get('mode')==='signup'
    return <Auth mode={signup?'signup':'login'} setMode={()=>navigate(signup?'/login':'/signup')} back={()=>navigate('/')} onAuthSuccess={()=>navigate('/dashboard')}/>
  }
  if (['/','/landing','/paper','/classic'].includes(route)) return <LandingPage/>
  return <Workspace/>
}
export default function App() {return <RouterProvider><AppRoutes/></RouterProvider>}
