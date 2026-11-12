import { ToastProvider } from './components/Toast'
import PdfViewerHost from './components/PdfViewer'
import ConfirmHost from './components/ConfirmHost'
import UpdateBanner from './components/UpdateBanner'
import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getTheme, isDark, toggleTheme, DARK, LIGHT } from './lib/theme'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PianoAlimentare from './pages/PianoAlimentare'
import DiarioGiornaliero from './pages/DiarioGiornaliero'
import TrackerProgressi from './pages/TrackerProgressi'
import Calendario from './pages/Calendario'
import Allenamento from './pages/Allenamento'
import ShareView from './pages/ShareView'
import CheckinSettimanale from './pages/CheckinSettimanale'
import Onboarding from './pages/Onboarding'
import Notifiche from './pages/Notifiche'
import Layout from './components/Layout'
import { saveLastProfile, loadLastProfile, clearCache, resolveOfflineSession, startAutoSync, subscribe as subscribeSync, snapshot as syncSnapshot, isNetworkError } from './lib/offline'

// Pagine caricate solo quando servono: i clienti non scaricano più gli strumenti del coach
import { lazyPage } from './lib/lazyPage'
const GraficiProgressi = lazyPage(() => import('./components/GraficiProgressi'))
const AdminPanel = lazyPage(() => import('./pages/AdminPanel'))
const DettaglioCliente = lazyPage(() => import('./pages/DettaglioCliente'))
const ImportaPiano = lazyPage(() => import('./pages/ImportaPiano'))
const ImportaAllenamento = lazyPage(() => import('./pages/ImportaAllenamento'))
const CreaPiano = lazyPage(() => import('./pages/CreaPiano'))
const CreaAllenamento = lazyPage(() => import('./pages/CreaAllenamento'))
const ModificaPiano = lazyPage(() => import('./pages/ModificaPiano'))
const ModificaAllenamento = lazyPage(() => import('./pages/ModificaAllenamento'))
const SelezionaPianoCliente = lazyPage(() => import('./pages/SelezionaPianoCliente'))
const SelezionaAllenamentoCliente = lazyPage(() => import('./pages/SelezionaAllenamentoCliente'))
const Abbonamenti = lazyPage(() => import('./pages/Abbonamenti'))
const MessaggiProgrammati = lazyPage(() => import('./pages/MessaggiProgrammati'))
const ReportPDF = lazyPage(() => import('./pages/ReportPDF'))
const ListaSpesa = lazyPage(() => import('./pages/ListaSpesa'))
const AssistenteAI = lazyPage(() => import('./pages/AssistenteAI'))
const Documenti = lazyPage(() => import('./pages/Documenti'))
const StoricoAllenamento = lazyPage(() => import('./pages/StoricoAllenamento'))
const ReportMensile = lazyPage(() => import('./pages/ReportMensile'))
const Anamnesi = lazyPage(() => import('./pages/Anamnesi'))
const ReportAllenamentoPage = lazyPage(() => import('./pages/ReportAllenamentoPage'))

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
  const [sync, setSync] = useState(syncSnapshot())
  const [justSynced, setJustSynced] = useState(false)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const un = subscribeSync(s => setSync(s))
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); un() }
  }, [])
  useEffect(() => {
    if (sync.lastSync?.at && Date.now() - sync.lastSync.at < 4000) {
      setJustSynced(true)
      const tm = setTimeout(() => setJustSynced(false), 3500)
      return () => clearTimeout(tm)
    }
  }, [sync.lastSync?.at])
  const { pending, failed, syncing } = sync
  if (!offline && !pending && !failed && !justSynced) return null
  let icon = 'ti-wifi-off', color = '#FAC775', bg = '#1a1a1a', msg
  if (failed) { icon = 'ti-alert-triangle'; color = '#F07070'; msg = `${failed} ${failed === 1 ? 'elemento non è stato inviato' : 'elementi non sono stati inviati'} — avvisa il coach` }
  else if (offline) msg = pending
    ? `Offline — ${pending} ${pending === 1 ? 'modifica salvata' : 'modifiche salvate'} sul telefono, si inviano appena torni online`
    : 'Sei offline — gli allenamenti si salvano sul telefono e si inviano appena c\'è rete'
  else if (pending || syncing) { icon = 'ti-refresh'; color = '#F4894A'; msg = `Sincronizzazione in corso… (${pending})` }
  else { icon = 'ti-circle-check'; color = '#6FCF97'; bg = '#10231a'; msg = 'Tutto sincronizzato' }
  return (
    <div role="status" style={{position:'fixed',top:0,left:0,right:0,zIndex:9999,background:bg,color:'#F0F0F0',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,fontSize:13}}>
      <i className={`ti ${icon}`} style={{fontSize:16,color}}/>
      <span>{msg}</span>
    </div>
  )
}

const C = {
  orange: '#D4570A', orangeLight: 'rgba(212,87,10,0.12)', orangeMid: '#F4894A',
  black: '#F0F0F0', white: '#ffffff', gray: '#161616',
  grayBorder: '#2A2A2A', textMuted: '#999'
}
export { C }


export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(getTheme())
  const [darkMode, setDarkMode] = useState(isDark())
  const [onboardedVersion, setOnboardedVersion] = useState(0)
  // La schermata di caricamento si toglie appena si sa cosa mostrare. Resta almeno 350 ms solo per non lampeggiare
  // (prima restava SEMPRE altri 1,5 secondi dopo l'arrivo del profilo: ogni avvio durava "rete + 1,5 s").
  const startedAt = useRef(Date.now())
  const finishLoading = () => { const wait = Math.max(0, 350 - (Date.now() - startedAt.current)); setTimeout(() => setLoading(false), wait) }

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
    // Senza rete non si può ricontrollare l'accesso: se su questo telefono si è già entrati, si continua con l'ultimo profilo salvato
    const goOffline = s => { setSession(s); const p = loadLastProfile(); if (p) setProfile(p); finishLoading() }
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      const off = !session ? resolveOfflineSession({ session, error, cachedProfile: loadLastProfile() }) : null
      if (off) { goOffline(off); return }
      setSession(session)
      if (session) {
        // Su questo telefono si è già entrati: si apre subito con l'ultimo profilo salvato e lo si rilegge in sottofondo
        const cached = loadLastProfile()
        if (cached && cached.id === session.user.id) { setProfile(cached); finishLoading() }
        fetchProfile(session.user.id)
      } else finishLoading()
    }).catch(() => {
      const off = resolveOfflineSession({ session: null, error: { message: 'Failed to fetch' }, cachedProfile: loadLastProfile() })
      if (off) goOffline(off); else finishLoading()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && event !== 'SIGNED_OUT') {
        const off = resolveOfflineSession({ session, error: null, cachedProfile: loadLastProfile() })
        if (off) { goOffline(off); return }
      }
      if (event === 'SIGNED_OUT') clearCache()
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); finishLoading() }
    })

    // quando torna la rete si rinnova l'accesso
    const onOnline = () => {
      supabase.auth.getSession().then(({ data: { session } }) => { if (session) { setSession(session); fetchProfile(session.user.id) } }).catch(() => {})
    }
    window.addEventListener('online', onOnline)
    return () => { subscription.unsubscribe(); window.removeEventListener('online', onOnline) }
  }, [])

  // Invio automatico di ciò che è stato salvato offline
  useEffect(() => {
    if (!session?.user?.id || profile?.role === 'admin') return
    return startAutoSync(supabase, session.user.id)
  }, [session?.user?.id, profile?.role])

  async function fetchProfile(userId) {
    let data = null, error = null
    try {
      const r = await supabase
        .from('profiles')
        .select('id, full_name, role, goal, height_cm, phone, notes')
        .eq('id', userId)
        .maybeSingle()
      data = r.data; error = r.error
    } catch (e) { error = e }
    if (data) {
      setProfile(data)
      saveLastProfile(data)
    } else if (error && isNetworkError(error)) {
      const p = loadLastProfile()   // senza rete: ultimo profilo salvato
      if (p?.id === userId) setProfile(p)
    }
    finishLoading()
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
              src="/logo-mark.png"
              alt="FOfit"
              style={{height:36, objectFit:'contain'}}
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <span style={{display:'none', fontSize:18, fontWeight:900, color:'#F0F0F0', letterSpacing:-.5}}>
              FO<span style={{color:'#F4894A'}}>fit</span>
            </span>
          </div>
        </div>

        {/* Nome */}
        <div style={{fontSize:36, fontWeight:900, color:'#F0F0F0', letterSpacing:-1.5, lineHeight:1, marginBottom:7}}>
          FO<span style={{color:'#F4894A'}}>fit</span>
        </div>

        {/* Tagline */}
        <div style={{fontSize:11, color:'#AAA', fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:40}}>
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
        fontSize:9, color:'#F0F0F0', letterSpacing:'0.1em', fontWeight:700,
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
      <PdfViewerHost />
      <ConfirmHost />
      <UpdateBanner />
    </AuthContext.Provider>
    </ToastProvider>
    </ThemeContext.Provider>
  )
}
