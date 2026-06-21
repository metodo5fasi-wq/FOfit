import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useTheme } from '../App'

const NAV_CLIENT = [
  { to:'/', icon:'ti-layout-dashboard', label:'Dashboard', exact:true, color:'#F4894A' },
  { to:'/piano', icon:'ti-clipboard-list', label:'Piano alimentare', color:'#D4570A' },
  { to:'/diario', icon:'ti-pencil', label:'Diario', color:'#E8803A' },
  { to:'/allenamento', icon:'ti-barbell', label:'Allenamento', color:'#D4570A' },
  { to:'/checkin', icon:'ti-mood-happy', label:'Check-in', color:'#9B59B6' },
  { to:'/messaggi', icon:'ti-message', label:'Messaggi', color:'#3B6D11' },
  { to:'/report', icon:'ti-chart-bar', label:'Report', color:'#4A90D4' },
  { to:'/progressi', icon:'ti-chart-line', label:'Progressi', color:'#3B8C5A' },
  { to:'/spesa', icon:'ti-shopping-cart', label:'Lista spesa', color:'#4A90D4' },
  { to:'/ai', icon:'ti-robot', label:'FO Coach AI', color:'#9B59B6' },
  { to:'/calendario', icon:'ti-calendar', label:'Prenota chiamata', color:'#3B8CD4' },
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
]

function Sidebar({ profile, onClose, onLogout, theme, darkMode, onToggleTheme }) {
  const isAdmin = profile?.role === 'admin'
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
    <div style={{display:'flex',flexDirection:'column',height:'100%',background: darkMode ? '#000000' : '#0F0F0F'}}>

      {/* LOGO */}
      <div style={{padding:'22px 20px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:11}}>
          <div style={{width:38,height:38,borderRadius:11,background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(212,87,10,0.4)',flexShrink:0}}>
            <i className="ti ti-bolt" style={{color:'white',fontSize:19}}/>
          </div>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:'white',letterSpacing:-0.5,lineHeight:1}}>
              FO<span style={{color:'#F4894A'}}>fit</span>
            </div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',marginTop:2}}>FOFIT.FIT</div>
          </div>
        </div>
      </div>

      {/* PROFILO */}
      <div style={{padding:'14px 16px',margin:'12px 12px 4px',background:'rgba(255,255,255,0.05)',borderRadius:12,border:'0.5px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white'}}>
            {initials}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:'white',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {profile?.full_name || 'Utente'}
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1}}>
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
            <div style={{fontSize:9,letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',padding:'10px 10px 5px',textTransform:'uppercase'}}>Menu</div>
            {NAV_CLIENT.map(item => (
              <NavLink key={item.to} to={item.to} end={item.exact} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:10,padding:'9px 10px',
                  borderRadius:9,marginBottom:2,textDecoration:'none',transition:'all 0.15s',
                  background:isActive?`${item.color}22`:'transparent',
                  borderLeft:isActive?`2.5px solid ${item.color}`:'2.5px solid transparent',
                  color:isActive?'white':'rgba(255,255,255,0.48)',
                })}>
                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:13,fontWeight:500}}>{item.label}</span>
                {item.to==='/ai'&&<span style={{marginLeft:'auto',fontSize:9,background:'linear-gradient(90deg,#9B59B6,#D4570A)',color:'white',padding:'2px 6px',borderRadius:10,fontWeight:700}}>AI</span>}
              </NavLink>
            ))}
          </>
        )}

        {/* MENU ADMIN */}
        {isAdmin && (
          <>
            <div style={{fontSize:9,letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',padding:'10px 10px 5px',textTransform:'uppercase'}}>Gestione clienti</div>
            {NAV_ADMIN.map(item => (
              <NavLink key={item.to} to={item.to} end={item.exact} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:10,padding:'9px 10px',
                  borderRadius:9,marginBottom:2,textDecoration:'none',transition:'all 0.15s',
                  background:isActive?`${item.color}22`:'transparent',
                  borderLeft:isActive?`2.5px solid ${item.color}`:'2.5px solid transparent',
                  color:isActive?'white':'rgba(255,255,255,0.48)',
                })}>
                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:13,fontWeight:500}}>{item.label}</span>
              </NavLink>
            ))}

            <div style={{fontSize:9,letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',padding:'12px 10px 5px',textTransform:'uppercase'}}>Importa</div>
            {ADMIN_NAV_IMPORTA.map(item => (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:10,padding:'9px 10px',
                  borderRadius:9,marginBottom:2,textDecoration:'none',transition:'all 0.15s',
                  background:isActive?`${item.color}22`:'transparent',
                  borderLeft:isActive?`2.5px solid ${item.color}`:'2.5px solid transparent',
                  color:isActive?'white':'rgba(255,255,255,0.48)',
                })}>
                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:13,fontWeight:500}}>{item.label}</span>
              </NavLink>
            ))}

            <div style={{fontSize:9,letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',padding:'12px 10px 5px',textTransform:'uppercase'}}>Modifica</div>
            {ADMIN_NAV_MODIFICA.map(item => (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                style={({ isActive }) => ({
                  display:'flex',alignItems:'center',gap:10,padding:'9px 10px',
                  borderRadius:9,marginBottom:2,textDecoration:'none',transition:'all 0.15s',
                  background:isActive?`${item.color}22`:'transparent',
                  borderLeft:isActive?`2.5px solid ${item.color}`:'2.5px solid transparent',
                  color:isActive?'white':'rgba(255,255,255,0.48)',
                })}>
                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`${item.color}22`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
                </div>
                <span style={{fontSize:13,fontWeight:500}}>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </div>

            {/* FOOTER */}
      <div style={{padding:'12px 16px',borderTop:'0.5px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <button onClick={onLogout} style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:'rgba(255,255,255,0.3)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit'}}>
          <i className="ti ti-logout" style={{fontSize:14}}/>Esci
        </button>
        <button onClick={onToggleTheme} style={{
          background:'rgba(255,255,255,0.08)',border:'none',borderRadius:20,
          padding:'5px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,
          color:'rgba(255,255,255,0.5)',fontSize:11,fontFamily:'inherit'
        }}>
          <i className={`ti ${darkMode?'ti-sun':'ti-moon'}`} style={{fontSize:13}}/>
          {darkMode?'Light':'Dark'}
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)',background:'#0F0F0F',boxSizing:'border-box'}}>

      {/* SIDEBAR DESKTOP */}
      {!isMobile && (
        <div style={{width:230,flexShrink:0,borderRight:'0.5px solid rgba(255,255,255,0.04)'}}>
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
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:theme.bg,minWidth:0,transition:'background 0.3s'}}>

        {/* TOPBAR MOBILE */}
        {isMobile && (
          <div style={{
            background:'#0F0F0F', minHeight:52, display:'flex', alignItems:'center',
            justifyContent:'space-between', padding:'10px 14px',
            flexShrink:0
          }}>
            <button
              onClick={()=>setMobileOpen(true)}
              style={{background:'#D4570A',border:'none',color:'white',width:38,height:38,borderRadius:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,touchAction:'manipulation',WebkitTapHighlightColor:'transparent',boxShadow:'0 2px 8px rgba(212,87,10,0.5)'}}>
              <i className="ti ti-menu-2" style={{fontSize:20,pointerEvents:'none'}}/>
            </button>
            <div style={{fontSize:17,fontWeight:700,color:'white',letterSpacing:-0.5}}>
              FO<span style={{color:'#F4894A'}}>fit</span>
            </div>
            <div style={{width:38}}/>
          </div>
        )}

        <Outlet/>
      </div>
    </div>
  )
}
