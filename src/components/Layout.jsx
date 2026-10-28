import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useTheme } from '../App'

const NAV_CLIENT = [
  { to:'/', icon:'ti-layout-dashboard', label:'Dashboard', exact:true, color:'#F4894A' },
  { to:'/piano', icon:'ti-clipboard-list', label:'Piano alimentare', color:'#D4570A' },
  { to:'/diario', icon:'ti-pencil', label:'Diario', color:'#E8803A' },
  { to:'/allenamento', icon:'ti-barbell', label:'Allenamento', color:'#D4570A' },
  { to:'/progressi', icon:'ti-chart-line', label:'Progressi', color:'#4A90D4' },
  { to:'/ai', icon:'ti-brain', label:'AI Coach', color:'#9B59B6' },
  { to:'/calendario', icon:'ti-calendar', label:'Prenota chiamata', color:'#4A90D4' },
  { to:'/spesa', icon:'ti-shopping-cart', label:'Lista spesa', color:'#3B8C5A' },
  { to:'/notifiche', icon:'ti-bell', label:'Notifiche', color:'#E8A020' },
  { to:'/documenti', icon:'ti-folder', label:'Documenti', color:'#3B8C5A' },
]

const NAV_ADMIN = [
  { to:'/admin', icon:'ti-users', label:'Clienti', color:'#D4570A' },
]

const ADMIN_NAV_IMPORTA = [
  { to:'/importa', icon:'ti-file-upload', label:'Importa piano alimentare', color:'#F4894A' },
  { to:'/importa-allenamento', icon:'ti-barbell', label:'Importa scheda allenamento', color:'#D4570A' },
]

const ADMIN_NAV_MODIFICA = [
  { to:'/modifica-piano-cliente', icon:'ti-tools-kitchen-2', label:'Modifica piano alimentare', color:'#3B8C5A' },
  { to:'/modifica-allenamento-cliente', icon:'ti-pencil', label:'Modifica scheda allenamento', color:'#4A90D4' },
  { to:'/abbonamenti', icon:'ti-credit-card', label:'Abbonamenti', color:'#9B59B6' },
  { to:'/messaggi-programmati', icon:'ti-calendar-time', label:'Messaggi programmati', color:'#E8A020' },
  { to:'/report-pdf', icon:'ti-file-type-pdf', label:'Report PDF', color:'#E24B4A' },
]

function Sidebar({ profile, onClose, onLogout, theme, darkMode, onToggleTheme }) {
  const isAdmin = profile?.role === 'admin'
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    if (!profile || isAdmin) return
    async function fetchUnread() {
      const { count } = await supabase
        .from('coach_messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', profile.id)
        .eq('sender_role', 'coach')
        .eq('is_read', false)
      setUnreadMessages(count || 0)
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [profile])

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : 'U'
  const goalLabel = {
    dimagrimento: '🔥 Dimagrimento',
    massa: '💪 Aumento massa',
    mantenimento: '⚖️ Mantenimento',
    definizione: '✨ Definizione',
  }[profile?.goal] || '🎯 Obiettivo'

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#050505'}}>

      {/* LOGO */}
      <div style={{padding:'24px 20px 18px',borderBottom:'0.5px solid rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <img src="/logo-dark.png" alt="FOfit" style={{height:28,objectFit:'contain',display:'block'}}/>
        <div style={{background:'rgba(212,87,10,0.15)',border:'0.5px solid rgba(212,87,10,0.3)',borderRadius:20,padding:'3px 9px',fontSize:9,fontWeight:800,color:'#F4894A',letterSpacing:'0.08em'}}>
          {isAdmin ? 'ADMIN' : 'PRO'}
        </div>
      </div>

      {/* PROFILO */}
      <div style={{padding:'12px',margin:'10px 10px 4px',background:'rgba(255,255,255,0.03)',borderRadius:12,border:'0.5px solid rgba(255,255,255,0.05)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'white'}}>
            {initials}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:'#F0F0F0',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {profile?.full_name || 'Utente'}
            </div>
            <div style={{fontSize:10,color:'#CCC',marginTop:2}}>
              {isAdmin ? '⚡ Coach · Admin' : goalLabel}
            </div>
          </div>
        </div>
      </div>

      {/* VOCI NAV */}
      <div style={{flex:1,overflowY:'auto',padding:'8px'}}>

        {/* MENU CLIENTE */}
        {!isAdmin && (
          <>
            <div style={{fontSize:9,letterSpacing:'0.1em',color:'#CCC',padding:'12px 10px 4px',textTransform:'uppercase',fontWeight:700}}>Menu</div>
            {NAV_CLIENT.map(item => (
              <NavLink key={item.to} to={item.to} end={item.exact} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:9,padding:'8px 10px',
                  borderRadius:10,marginBottom:1,textDecoration:'none',transition:'background 0.15s',
                  background:isActive?`${item.color}18`:'transparent',
                  color:isActive?'#F0F0F0':'#444',
                })}>
                <div style={{width:30,height:30,borderRadius:8,flexShrink:0,background:`${item.color}${`22`}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:12,fontWeight:500,flex:1}}>{item.label}</span>
                {item.to==='/ai'&&<span style={{fontSize:9,background:'rgba(155,89,182,0.25)',color:'#C39BE0',padding:'2px 7px',borderRadius:10,fontWeight:700,border:'0.5px solid rgba(155,89,182,0.3)'}}>AI</span>}
              </NavLink>
            ))}
          </>
        )}

        {/* MENU ADMIN */}
        {isAdmin && (
          <>
            <div style={{fontSize:9,letterSpacing:'0.1em',color:'#CCC',padding:'12px 10px 4px',textTransform:'uppercase',fontWeight:700}}>Gestione clienti</div>
            {NAV_ADMIN.map(item => (
              <NavLink key={item.to} to={item.to} end={item.exact} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:9,padding:'8px 10px',
                  borderRadius:10,marginBottom:1,textDecoration:'none',transition:'background 0.15s',
                  background:isActive?`${item.color}18`:'transparent',
                  color:isActive?'#F0F0F0':'#444',
                })}>
                <div style={{width:30,height:30,borderRadius:8,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:12,fontWeight:500}}>{item.label}</span>
              </NavLink>
            ))}

            <div style={{fontSize:9,letterSpacing:'0.1em',color:'#CCC',padding:'12px 10px 4px',textTransform:'uppercase',fontWeight:700}}>Importa</div>
            {ADMIN_NAV_IMPORTA.map(item => (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:9,padding:'8px 10px',
                  borderRadius:10,marginBottom:1,textDecoration:'none',transition:'background 0.15s',
                  background:isActive?`${item.color}18`:'transparent',
                  color:isActive?'#F0F0F0':'#444',
                })}>
                <div style={{width:30,height:30,borderRadius:8,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:12,fontWeight:500}}>{item.label}</span>
              </NavLink>
            ))}

            <div style={{fontSize:9,letterSpacing:'0.1em',color:'#CCC',padding:'12px 10px 4px',textTransform:'uppercase',fontWeight:700}}>Modifica</div>
            {ADMIN_NAV_MODIFICA.map(item => (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:9,padding:'8px 10px',
                  borderRadius:10,marginBottom:1,textDecoration:'none',transition:'background 0.15s',
                  background:isActive?`${item.color}18`:'transparent',
                  color:isActive?'#F0F0F0':'#444',
                })}>
                <div style={{width:30,height:30,borderRadius:8,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:12,fontWeight:500}}>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </div>

            {/* FOOTER */}
      <div style={{padding:'10px 16px',borderTop:'0.5px solid rgba(255,255,255,0.04)',display:'flex',alignItems:'center',background:'rgba(0,0,0,0.3)'}}>
        <button onClick={onLogout} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#A0A0A0',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit'}}>
          <i className="ti ti-logout" style={{fontSize:13,color:'#CCC'}}/>Esci
        </button>

      </div>
    </div>
  )
}

export default function Layout() {
  const { profile } = useAuth()
  const { theme, darkMode, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Controlla abbonamento scaduto per clienti
  const isClient = profile?.role !== 'admin'
  const [freshProfile, setFreshProfile] = useState(null)

  useEffect(() => {
    if (!profile?.id || !isClient) return
    // Ricarica profilo fresco da Supabase ad ogni mount
    supabase.from('profiles').select('subscription_end,payment_type,installments,installments_paid')
      .eq('id', profile.id).single()
      .then(({ data }) => { if (data) setFreshProfile(data) })
  }, [profile?.id])

  const activeProfile = freshProfile || profile
  const subEnd = activeProfile?.subscription_end
  const subBlocked = isClient && subEnd && new Date(subEnd+'T23:59:59') < new Date()
  // Conto alla rovescia — giorni rimanenti
  const daysLeft = subEnd && isClient ? Math.ceil((new Date(subEnd+'T23:59:59') - new Date()) / (1000*60*60*24)) : null
  const showCountdown = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7
  const installBlocked = isClient &&
    activeProfile?.payment_type === 'rate' &&
    activeProfile?.installments_paid !== null &&
    activeProfile?.installments_paid !== undefined &&
    parseInt(activeProfile?.installments_paid||0) < parseInt(activeProfile?.installments||1)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Schermata blocco abbonamento
  if (subBlocked || installBlocked) {
    return (
      <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#080808',padding:24,textAlign:'center'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:'#1A0808',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
          <i className="ti ti-lock" style={{fontSize:36,color:'#E24B4A'}}/>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:'#F0F0F0',marginBottom:8}}>
          {installBlocked ? 'Rata non saldata' : 'Abbonamento scaduto'}
        </div>
        <div style={{fontSize:14,color:'#CCC',lineHeight:1.6,maxWidth:300,marginBottom:24}}>
          {installBlocked
            ? 'Non hai saldato una o più rate del tuo abbonamento. Contatta il coach per sbloccare l\'accesso.'
            : 'Il tuo abbonamento è scaduto. Contatta il coach per rinnovarlo e tornare ad accedere all\'app.'}
        </div>
        <div style={{background:'#101010',borderRadius:12,padding:'16px 20px',border:'0.5px solid #1C1C1C',marginBottom:16}}>
          <div style={{fontSize:12,color:'#CCC',marginBottom:4}}>Per assistenza contatta</div>
          <div style={{fontSize:14,fontWeight:700,color:'#D4570A'}}>Federico Obinu — FOfit Coach</div>
        </div>
        <button onClick={async()=>{ await supabase.auth.signOut(); window.location.href='/login' }}
          style={{background:'#161616',color:'#CCC',border:'0.5px solid #222',borderRadius:9,padding:'10px 20px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
          Esci dall'account
        </button>
      </div>
    )
  }

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:'#0F0F0F',boxSizing:'border-box',
      // Safe area gestita dai singoli componenti — niente padding qui
    }}>

      {/* SIDEBAR DESKTOP */}
      {!isMobile && (
        <div style={{width:220,flexShrink:0,borderRight:'0.5px solid rgba(255,255,255,0.03)'}}>
          <Sidebar profile={profile} onClose={()=>{}} onLogout={handleLogout} theme={theme} darkMode={darkMode} onToggleTheme={toggleTheme}/>
        </div>
      )}

      {/* SIDEBAR MOBILE */}
      {isMobile && mobileOpen && (
        <>
          <div onClick={()=>setMobileOpen(false)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:98}}/>
          <div style={{position:'fixed',left:0,top:0,bottom:0,width:260,zIndex:99,boxShadow:'4px 0 24px rgba(0,0,0,0.5)'}}>
            <Sidebar profile={profile} onClose={()=>setMobileOpen(false)} onLogout={handleLogout} theme={theme} darkMode={darkMode} onToggleTheme={toggleTheme}/>
          </div>
        </>
      )}

      {/* CONTENUTO PRINCIPALE */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#080808',minWidth:0}}>

        {/* TOPBAR MOBILE */}
        {isMobile && (
          <div style={{
            background:'#080808',
            minHeight:'calc(52px + env(safe-area-inset-top, 0px))',
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            padding:'0 14px',
            paddingTop:'calc(8px + env(safe-area-inset-top, 0px))',
            paddingBottom:'8px',
            flexShrink:0,
            borderBottom:'0.5px solid #151515',
            position:'sticky',
            top:0,
            zIndex:50,
          }}>
            <button onClick={()=>setMobileOpen(true)} style={{
              background:'#D4570A',
              border:'none', color:'white', width:36, height:36, borderRadius:10,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0, touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
            }}>
              <i className="ti ti-menu-2" style={{fontSize:17,pointerEvents:'none'}}/>
            </button>
            <img src="/logo-dark.png" alt="FOfit" style={{height:30,objectFit:'contain'}}/>
            <div style={{width:36,display:'flex',justifyContent:'flex-end'}}>
              <div style={{width:8,height:8,background:'#3B8C5A',borderRadius:'50%'}}/>
            </div>
          </div>
        )}

        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>

          {/* BANNER SCADENZA ABBONAMENTO */}
          {showCountdown && (
            <div style={{
              background: daysLeft <= 2 ? 'rgba(226,75,74,0.15)' : daysLeft <= 4 ? 'rgba(232,160,32,0.12)' : 'rgba(212,87,10,0.1)',
              borderBottom: `0.5px solid ${daysLeft <= 2 ? 'rgba(226,75,74,0.4)' : daysLeft <= 4 ? 'rgba(232,160,32,0.3)' : 'rgba(212,87,10,0.25)'}`,
              padding:'10px 16px',
              display:'flex',
              alignItems:'center',
              gap:10,
              flexShrink:0,
            }}>
              <div style={{
                width:32,height:32,borderRadius:9,flexShrink:0,
                background: daysLeft <= 2 ? 'rgba(226,75,74,0.2)' : daysLeft <= 4 ? 'rgba(232,160,32,0.15)' : 'rgba(212,87,10,0.15)',
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>
                <i className="ti ti-clock-hour-4" style={{fontSize:16, color: daysLeft <= 2 ? '#E24B4A' : daysLeft <= 4 ? '#E8A020' : '#F4894A'}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{
                  fontSize:12, fontWeight:700,
                  color: daysLeft <= 2 ? '#F07070' : daysLeft <= 4 ? '#E8C050' : '#F4894A',
                }}>
                  {daysLeft === 0
                    ? 'Il tuo abbonamento scade oggi!'
                    : daysLeft === 1
                    ? 'Il tuo abbonamento scade domani!'
                    : `Abbonamento in scadenza tra ${daysLeft} giorni`}
                </div>
                <div style={{fontSize:10,color:'#888',marginTop:1}}>
                  Contatta il coach per rinnovarlo
                </div>
              </div>
              <div style={{
                background: daysLeft <= 2 ? '#E24B4A' : daysLeft <= 4 ? '#E8A020' : '#D4570A',
                color:'white',borderRadius:20,padding:'3px 10px',
                fontSize:11,fontWeight:800,flexShrink:0,
              }}>
                {daysLeft === 0 ? 'OGGI' : `${daysLeft}g`}
              </div>
            </div>
          )}

          <Outlet/>
        </div>

        {/* BOTTOM NAV MOBILE — solo per clienti */}
        {isMobile && profile?.role !== 'admin' && (
          <div style={{
            background:'#080808',
            borderTop:'0.5px solid #111',
            paddingBottom:'env(safe-area-inset-bottom, 0px)',
            display:'flex',
            flexShrink:0,
            zIndex:50,
            position:'relative',
          }}>
            {[
              { to:'/', icon:'ti-layout-dashboard', label:'Home', exact:true, color:'#D4570A' },
              { to:'/piano', icon:'ti-clipboard-list', label:'Piano', color:'#D4570A' },
              { to:'/diario', icon:'ti-pencil', label:'Diario', color:'#4A90D4' },
              { to:'/allenamento', icon:'ti-barbell', label:'Workout', color:'#3B8C5A' },
              { to:'/progressi', icon:'ti-chart-line', label:'Progressi', color:'#9B59B6' },
            ].map(item => (
              <NavLink key={item.to} to={item.to} end={item.exact} style={({isActive})=>({
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                padding:'8px 2px 6px', textDecoration:'none',
                transition:'color 0.15s',
              })}>
                {({isActive}) => <>
                  <div style={{
                    width:40, height:36, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
                    background: isActive ? `${item.color}20` : 'transparent',
                    transition:'background 0.15s',
                  }}>
                    <i className={`ti ${item.icon}`} style={{fontSize:19, color: isActive ? item.color : '#888'}}/>
                  </div>
                  <span style={{fontSize:9, marginTop:2, fontWeight: isActive ? 700 : 500, color: isActive ? item.color : '#888', letterSpacing:'0.02em'}}>{item.label}</span>
                </>}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
