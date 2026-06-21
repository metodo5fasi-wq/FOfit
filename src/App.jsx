import React, { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getTheme, isDark, toggleTheme, DARK, LIGHT } from './lib/theme'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PianoAlimentare from './pages/PianoAlimentare'
import DiarioGiornaliero from './pages/DiarioGiornaliero'
import TrackerProgressi from './pages/TrackerProgressi'
import ListaSpesa from './pages/ListaSpesa'
import AssistenteAI from './pages/AssistenteAI'
import Calendario from './pages/Calendario'
import Allenamento from './pages/Allenamento'
import StoricoAllenamento from './pages/StoricoAllenamento'
import ShareView from './pages/ShareView'
import ImportaAllenamento from './pages/ImportaAllenamento'
import ReportMensile from './pages/ReportMensile'
import CheckinSettimanale from './pages/CheckinSettimanale'
import MessaggiCoach from './pages/MessaggiCoach'
import AdminPanel from './pages/AdminPanel'
import ImportaPiano from './pages/ImportaPiano'
import Onboarding from './pages/Onboarding'
import Layout from './components/Layout'

// ─────────────────────────────────────────────────────────
// ERROR BOUNDARY — mostra l'errore invece di una pagina bianca
// ─────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center',background:'#1a0800',color:'white',fontFamily:'system-ui'}}>
          <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Si è verificato un errore</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',marginBottom:20,maxWidth:400,wordBreak:'break-word'}}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button onClick={()=>{ this.setState({error:null}); window.location.href = '/' }} style={{background:'#D4570A',color:'white',border:'none',borderRadius:8,padding:'10px 24px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
            Torna alla home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
export const ThemeContext = createContext(LIGHT)
export const useTheme = () => useContext(ThemeContext)

// Banner offline
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,zIndex:9999,background:'#1a1a1a',color:'white',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,fontSize:13}}>
      <i className="ti ti-wifi-off" style={{fontSize:16,color:'#FAC775'}}/>
      <span>Nessuna connessione — alcune funzioni potrebbero non funzionare</span>
    </div>
  )
}

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
  const [theme, setTheme] = useState(getTheme())
  const [darkMode, setDarkMode] = useState(isDark())
  const [onboardedVersion, setOnboardedVersion] = useState(0)

  function markOnboarded() {
    setOnboardedVersion(v => v + 1)
  }

  function handleToggleTheme() {
    const next = toggleTheme()
    setDarkMode(next === 'dark')
    setTheme(next === 'dark' ? DARK : LIGHT)
  }

  // Inietta CSS variables del tema dinamicamente
  useEffect(() => {
    const root = document.documentElement
    const t = theme
    root.style.setProperty('--bg', t.bg)
    root.style.setProperty('--bg-card', t.bgCard)
    root.style.setProperty('--bg-input', t.bgInput)
    root.style.setProperty('--bg-subtle', t.bgSubtle)
    root.style.setProperty('--border', t.border)
    root.style.setProperty('--text', t.text)
    root.style.setProperty('--text-muted', t.textMuted)
    root.style.setProperty('--orange', t.orange)
    root.style.setProperty('--orange-light', t.orangeLight)
    root.style.setProperty('--green', t.green)
    root.style.setProperty('--green-light', t.greenLight)
    document.body.style.background = t.bg
    document.body.style.color = t.text
  }, [theme])

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
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, goal, height_cm, phone, notes')
      .eq('id', userId)
      .maybeSingle()
    if (data) {
      setProfile(data)
    }
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
    <ThemeContext.Provider value={{theme, darkMode, toggleTheme: handleToggleTheme}}>
    <AuthContext.Provider value={{ session, profile, setProfile, markOnboarded }}>
      <BrowserRouter>
        <OfflineBanner/>
        <div style={{background: theme.bg, minHeight:'100dvh', transition:'background 0.3s', colorScheme: darkMode ? 'dark' : 'light'}}>
        <ErrorBoundary>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/share/:token" element={<ShareView />} />
          <Route path="/onboarding" element={session && profile ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={
              (() => {
                // eslint-disable-next-line no-unused-expressions
                onboardedVersion // forza re-render quando onboarding completato
                const needsOnboarding = session && profile && profile.role === 'client' && !localStorage.getItem(`fofit_onboarded_${profile.id}`)
                return needsOnboarding ? <Navigate to="/onboarding" /> : <Dashboard />
              })()
            } />
            <Route path="piano" element={<PianoAlimentare />} />
            <Route path="diario" element={<DiarioGiornaliero />} />
            <Route path="progressi" element={<TrackerProgressi />} />
            <Route path="spesa" element={<ListaSpesa />} />
            <Route path="ai" element={<AssistenteAI />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="allenamento" element={<Allenamento />} />
            <Route path="storico-allenamento" element={<StoricoAllenamento />} />
            <Route path="importa-allenamento" element={!profile ? null : profile.role === 'admin' ? <ImportaAllenamento /> : <Navigate to="/" />} />
            <Route path="report" element={<ReportMensile />} />
            <Route path="checkin" element={<CheckinSettimanale />} />
            <Route path="messaggi" element={<MessaggiCoach />} />
            <Route path="admin" element={!profile ? null : profile.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="importa" element={!profile ? null : profile.role === 'admin' ? <ImportaPiano /> : <Navigate to="/" />} />
          </Route>
        </Routes>
        </ErrorBoundary>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
    </ThemeContext.Provider>
  )
}
