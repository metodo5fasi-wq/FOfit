import { ToastProvider } from './components/Toast'
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
import ModificaPiano from './pages/ModificaPiano'
import ModificaAllenamento from './pages/ModificaAllenamento'
import SelezionaPianoCliente from './pages/SelezionaPianoCliente'
import SelezionaAllenamentoCliente from './pages/SelezionaAllenamentoCliente'
import Anamnesi from './pages/Anamnesi'
import Documenti from './pages/Documenti'
import ReportAllenamentoPage from './pages/ReportAllenamentoPage'
import Abbonamenti from './pages/Abbonamenti'
import MessaggiProgrammati from './pages/MessaggiProgrammati'
import ReportPDF from './pages/ReportPDF'
import AdminPanel from './pages/AdminPanel'
import ImportaPiano from './pages/ImportaPiano'
import CreaPiano from './pages/CreaPiano'
import CreaAllenamento from './pages/CreaAllenamento'
import Onboarding from './pages/Onboarding'
import DettaglioCliente from './pages/DettaglioCliente'
import Notifiche from './pages/Notifiche'
import GraficiProgressi from './components/GraficiProgressi'
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
    --radius: 12px; --radius-lg: 16px; --radius-xl: 20px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06);
    --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { scroll-behavior: smooth; touch-action: pan-x pan-y; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--gray);
    color: var(--black);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    overscroll-behavior: none;
  }
  button { cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; }
  button:active { transform: scale(0.97); transition: transform 0.1s; }
  input, textarea, select { font-family: inherit; font-size: 16px; }
  input:focus, textarea:focus, select:focus { outline: 2px solid var(--orange); outline-offset: 1px; }
  img { display: block; max-width: 100%; }
  a { -webkit-tap-highlight-color: transparent; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--gray-border); border-radius: 2px; }

  /* Animazioni pagina */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .page-enter { animation: fadeInUp 0.22s ease-out both; }
  .fade-in { animation: fadeIn 0.2s ease-out both; }
  .slide-in { animation: slideInRight 0.2s ease-out both; }
  .spin { animation: spin 0.8s linear infinite; }

  /* Skeleton loader */
  .skeleton {
    background: linear-gradient(90deg, var(--gray) 25%, var(--gray-border) 50%, var(--gray) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 8px;
  }

  /* Card interattive */
  .card-hover { transition: transform var(--transition), box-shadow var(--transition); }
  .card-hover:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .card-hover:active { transform: scale(0.99); }

  /* Pill badge */
  .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }

  /* Mobile safe area */
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-top { padding-top: env(safe-area-inset-top, 0px); }

  /* Previeni overflow orizzontale globale */
  html, body, #root { max-width: 100vw; overflow-x: hidden; }

  /* Touch action — previeni pinch zoom ma permetti scroll */
  * { -webkit-tap-highlight-color: transparent; touch-action: pan-x pan-y; }
  
  /* Bottoni — min tap target 44px iOS */
  button, a { min-height: 0; }

  /* Immagini responsive */
  img { max-width: 100%; height: auto; }

  /* Input — previeni zoom iOS su focus */
  @media (max-width: 768px) {
    input, textarea, select { font-size: 16px !important; }
    /* Padding bottom per barra navigazione mobile */
    .page-content { padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)); }
  }

  /* Fix altezza viewport mobile (esclude barra browser) */
  .full-height { height: 100dvh; min-height: 100dvh; }
  
  /* Scroll fluido su iOS */
  .scroll-area { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }

  /* Safe area — colora le zone fuori dall'app con il colore della UI */
  html { background: #080808; }

  /* Scrollbar dark premium */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #3A3A3A; }

  /* Selezione testo */
  ::selection { background: rgba(212,87,10,0.3); color: #F0F0F0; }

  /* Garantisce leggibilità ovunque */
  p, span, div, label, h1, h2, h3, h4, h5, h6 {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Input autofill dark */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0px 1000px #161616 inset !important;
    -webkit-text-fill-color: #F0F0F0 !important;
    caret-color: #F0F0F0;
  }

  /* Elimina gap su Android Chrome */
  @media (display-mode: standalone) {
    body { background: #080808; }
  }
  .safe-top { padding-top: env(safe-area-inset-top, 0px); }

  /* Input mobile fix (no zoom su iOS) */
  @media (max-width: 768px) {
    input, textarea, select { font-size: 16px !important; }
  }

  /* Overscroll */
  .scroll-area {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  /* Bottoni primari più belli */
  .btn-primary {
    background: linear-gradient(135deg, #D4570A 0%, #E8703A 100%);
    box-shadow: 0 2px 8px rgba(212, 87, 10, 0.35);
    transition: all var(--transition);
  }
  .btn-primary:hover { box-shadow: 0 4px 14px rgba(212, 87, 10, 0.45); transform: translateY(-1px); }
  .btn-primary:active { transform: scale(0.97); box-shadow: 0 1px 4px rgba(212, 87, 10, 0.3); }
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
      else setTimeout(() => setLoading(false), 1500)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setTimeout(() => setLoading(false), 1500) }
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
    setTimeout(() => setLoading(false), 1500)
  }

  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100dvh', background:'#080808', overflow:'hidden', position:'relative',
    }}>
      <style>{`
        @keyframes fofit-spin { to { transform: rotate(360deg); } }
        @keyframes fofit-bar {
          0%, 100% { opacity: .25; transform: scaleY(.4); }
          50% { opacity: 1; transform: scaleY(1); }
        }
        @keyframes fofit-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Cerchi concentrici decorativi */}
      {[280,200,130].map((size,i) => (
        <div key={i} style={{
          position:'absolute', width:size, height:size, borderRadius:'50%',
          border:`0.5px solid ${i===2?'rgba(212,87,10,0.12)':'rgba(255,255,255,0.03)'}`,
          top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          pointerEvents:'none',
        }}/>
      ))}

      {/* Contenuto centrale */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        gap:0, position:'relative', zIndex:1,
        animation:'fofit-fade .5s ease forwards',
      }}>

        {/* Ring + logo */}
        <div style={{position:'relative', width:88, height:88, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22}}>
          {/* Ring rotante */}
          <div style={{
            position:'absolute', inset:0, borderRadius:'50%',
            border:'1.5px solid #1A1A1A',
            borderTopColor:'#D4570A',
            animation:'fofit-spin 1s linear infinite',
          }}/>
          {/* Icona */}
          <div style={{
            width:64, height:64, background:'#0D0D0D', borderRadius:18,
            border:'0.5px solid #1C1C1C',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <img
              src="/logo-dark.png"
              alt="FOfit"
              style={{height:36, objectFit:'contain'}}
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <span style={{display:'none', fontSize:18, fontWeight:900, color:'#F0F0F0', letterSpacing:-.5}}>
              FO<span style={{color:'#D4570A'}}>fit</span>
            </span>
          </div>
        </div>

        {/* Nome */}
        <div style={{fontSize:36, fontWeight:900, color:'#F0F0F0', letterSpacing:-1.5, lineHeight:1, marginBottom:7}}>
          FO<span style={{color:'#D4570A'}}>fit</span>
        </div>

        {/* Tagline */}
        <div style={{fontSize:11, color:'#333', fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:40}}>
          Il tuo coach in tasca
        </div>

        {/* Barre animate */}
        <div style={{display:'flex', gap:5, alignItems:'flex-end', height:28}}>
          {[14,20,28,20,14].map((h,i) => (
            <div key={i} style={{
              width:4, height:h, borderRadius:2, background:'#D4570A',
              animation:`fofit-bar 1.2s ease-in-out infinite`,
              animationDelay:`${i*0.15}s`,
              transformOrigin:'bottom',
            }}/>
          ))}
        </div>
      </div>

      {/* URL in basso */}
      <div style={{
        position:'absolute', bottom:40,
        fontSize:9, color:'#222', letterSpacing:'0.1em', fontWeight:700,
        fontFamily:'inherit',
      }}>
        FOFIT.FIT
      </div>
    </div>
  )

  return (
    <ThemeContext.Provider value={{theme, darkMode, toggleTheme: handleToggleTheme}}>
      <ToastProvider>
    <AuthContext.Provider value={{ session, profile, setProfile, markOnboarded }}>
      <BrowserRouter>
        <OfflineBanner/>
        <div style={{background: '#080808', minHeight:'100dvh', colorScheme: 'dark', position:'relative', zIndex:0}}>
        <ErrorBoundary>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/share/:token" element={<ShareView />} />
          <Route path="/onboarding" element={session && profile ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={
              (() => {
                if (profile?.role === 'admin') return <Navigate to="/admin" />
                // eslint-disable-next-line no-unused-expressions
                onboardedVersion // forza re-render quando onboarding completato
                const needsOnboarding = session && profile && profile.role === 'client' && !localStorage.getItem(`fofit_onboarded_${profile.id}`)
                return needsOnboarding ? <Navigate to="/onboarding" /> : <Dashboard />
              })()
            } />
            <Route path="piano" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <PianoAlimentare />} />
            <Route path="diario" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <DiarioGiornaliero />} />
            <Route path="progressi" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <TrackerProgressi />} />
            <Route path="spesa" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <ListaSpesa />} />
            <Route path="ai" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <AssistenteAI />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="notifiche" element={<Notifiche />} />
            <Route path="grafici" element={<GraficiProgressi />} />
            <Route path="allenamento" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <Allenamento />} />
            <Route path="storico-allenamento" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <StoricoAllenamento />} />
            <Route path="importa-allenamento" element={!profile ? null : profile.role === 'admin' ? <ImportaAllenamento /> : <Navigate to="/" />} />
            <Route path="report" element={<ReportMensile />} />
            <Route path="checkin" element={<CheckinSettimanale />} />
            <Route path="modifica-piano/:planId" element={!profile ? null : profile.role === 'admin' ? <ModificaPiano /> : <Navigate to="/" />} />
            <Route path="modifica-piano-cliente" element={!profile ? null : profile.role === 'admin' ? <SelezionaPianoCliente /> : <Navigate to="/" />} />
            <Route path="modifica-allenamento/:planId" element={!profile ? null : profile.role === 'admin' ? <ModificaAllenamento /> : <Navigate to="/" />} />
            <Route path="anamnesi" element={<Anamnesi />} />
            <Route path="documenti" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <Documenti />} />
            <Route path="report-allenamento" element={profile?.role==='admin' ? <Navigate to="/admin"/> : <ReportAllenamentoPage />} />
            <Route path="abbonamenti" element={!profile ? null : profile.role === 'admin' ? <Abbonamenti /> : <Navigate to="/" />} />
            <Route path="messaggi-programmati" element={!profile ? null : profile.role === 'admin' ? <MessaggiProgrammati /> : <Navigate to="/" />} />
            <Route path="report-pdf" element={!profile ? null : profile.role === 'admin' ? <ReportPDF /> : <Navigate to="/" />} />
            <Route path="modifica-allenamento-cliente" element={!profile ? null : profile.role === 'admin' ? <SelezionaAllenamentoCliente /> : <Navigate to="/" />} />
            <Route path="admin" element={!profile ? null : profile.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="cliente/:clientId" element={!profile ? null : profile.role === 'admin' ? <DettaglioCliente /> : <Navigate to="/" />} />
            <Route path="importa" element={!profile ? null : profile.role === 'admin' ? <ImportaPiano /> : <Navigate to="/" />} />
            <Route path="crea-piano" element={!profile ? null : profile.role === 'admin' ? <CreaPiano /> : <Navigate to="/" />} />
            <Route path="crea-allenamento" element={!profile ? null : profile.role === 'admin' ? <CreaAllenamento /> : <Navigate to="/" />} />
          </Route>
        </Routes>
        </ErrorBoundary>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
    </ToastProvider>
    </ThemeContext.Provider>
  )
}
