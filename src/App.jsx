import React, { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PianoAlimentare from './pages/PianoAlimentare'
import DiarioGiornaliero from './pages/DiarioGiornaliero'
import TrackerProgressi from './pages/TrackerProgressi'
import ListaSpesa from './pages/ListaSpesa'
import AssistenteAI from './pages/AssistenteAI'
import AdminPanel from './pages/AdminPanel'
import Layout from './components/Layout'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const C = {
  orange: '#D4570A', orangeLight: '#FEF0E7', orangeMid: '#F4894A',
  black: '#111111', white: '#ffffff', gray: '#F5F3EF',
  grayBorder: '#E0DDD6', textMuted: '#888780'
}
export { C }

const globalStyles = `
  :root {
    --orange: ${C.orange}; --orange-light: ${C.orangeLight}; --orange-mid: ${C.orangeMid};
    --black: ${C.black}; --white: ${C.white}; --gray: ${C.gray};
    --gray-border: ${C.grayBorder}; --text-muted: ${C.textMuted};
    --radius: 10px; --radius-lg: 14px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--gray); color: var(--black); }
  button { cursor: pointer; font-family: inherit; }
  input, textarea, select { font-family: inherit; }
  ::-webkit-scrollbar { width: 4px; } 
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--gray-border); border-radius: 2px; }
`

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = globalStyles
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', background:'#111' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:28, fontWeight:500, color:'#D4570A', letterSpacing:-0.5 }}>FO<span style={{color:'white'}}>fit</span></div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:6 }}>Caricamento...</div>
      </div>
    </div>
  )

  return (
    <AuthContext.Provider value={{ session, profile, setProfile }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="piano" element={<PianoAlimentare />} />
            <Route path="diario" element={<DiarioGiornaliero />} />
            <Route path="progressi" element={<TrackerProgressi />} />
            <Route path="spesa" element={<ListaSpesa />} />
            <Route path="ai" element={<AssistenteAI />} />
            <Route path="admin" element={profile?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
