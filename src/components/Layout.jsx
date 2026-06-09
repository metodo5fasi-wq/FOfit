import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const nav = [
  { to:'/', icon:'ti-layout-dashboard', label:'Dashboard', exact:true },
  { to:'/piano', icon:'ti-clipboard-list', label:'Piano alimentare' },
  { to:'/diario', icon:'ti-pencil', label:'Diario giornaliero' },
  { to:'/progressi', icon:'ti-chart-line', label:'Tracker progressi' },
  { to:'/spesa', icon:'ti-shopping-cart', label:'Lista spesa' },
  { to:'/ai', icon:'ti-robot', label:'Assistente AI' },
]

const s = {
  shell: { display:'flex', height:'100dvh', overflow:'hidden' },
  sidebar: { width:225, background:'#111111', display:'flex', flexDirection:'column', flexShrink:0 },
  sidebarMobile: { position:'fixed', left:0, top:0, bottom:0, zIndex:100, width:225, background:'#111111', display:'flex', flexDirection:'column', boxShadow:'4px 0 20px rgba(0,0,0,0.3)' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:99 },
  logoWrap: { padding:'20px 18px 16px', borderBottom:'0.5px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:10 },
  logoIcon: { width:34, height:34, background:'#D4570A', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  brand: { fontSize:17, fontWeight:500, color:'white', letterSpacing:-0.3 },
  brandSpan: { color:'#D4570A' },
  domain: { fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em' },
  userWrap: { padding:'13px 18px', borderBottom:'0.5px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:10 },
  avatar: { width:34, height:34, borderRadius:'50%', background:'#D4570A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'white', flexShrink:0 },
  userName: { fontSize:13, color:'white', fontWeight:500 },
  userRole: { fontSize:10, color:'rgba(255,255,255,0.38)' },
  nav: { padding:'8px', flex:1, overflowY:'auto' },
  navSection: { fontSize:9, letterSpacing:'0.1em', color:'rgba(255,255,255,0.28)', padding:'12px 10px 5px', textTransform:'uppercase' },
  navItem: { display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8, marginBottom:1, color:'rgba(255,255,255,0.52)', fontSize:13, textDecoration:'none', transition:'all 0.15s' },
  footer: { padding:'13px 18px', borderTop:'0.5px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logoutBtn: { display:'flex', alignItems:'center', gap:7, fontSize:12, color:'rgba(255,255,255,0.32)', cursor:'pointer', background:'none', border:'none' },
  version: { fontSize:10, color:'rgba(255,255,255,0.18)' },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#F5F3EF' },
  mobilebar: { background:'#111111', padding:'0 16px', height:52, alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  hamburger: { background:'none', border:'none', color:'white', fontSize:22, display:'flex', alignItems:'center' },
}

export default function Layout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = window.innerWidth < 768
  const [, forceUpdate] = React.useState(0)
React.useEffect(() => { if (profile) forceUpdate(n => n + 1) }, [profile?.role])

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : 'U'

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <>
      <div style={s.logoWrap}>
        <div style={s.logoIcon}><i className="ti ti-bolt" style={{color:'white',fontSize:17}} /></div>
        <div>
          <div style={s.brand}>FO<span style={s.brandSpan}>fit</span></div>
          <div style={s.domain}>FOFIT.FIT</div>
        </div>
      </div>
      <div style={s.userWrap}>
        <div style={s.avatar}>{initials}</div>
        <div>
          <div style={s.userName}>{profile?.full_name || 'Utente'}</div>
          <div style={s.userRole}>{profile?.role === 'admin' ? 'Coach · Admin' : 'Cliente'}</div>
        </div>
      </div>
      <div style={s.nav}>
        <div style={s.navSection}>Principale</div>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              ...s.navItem,
              background: isActive ? '#D4570A' : 'transparent',
              color: isActive ? 'white' : 'rgba(255,255,255,0.52)',
            })}>
            <i className={`ti ${item.icon}`} style={{fontSize:17,flexShrink:0}} />
            {item.label}
          </NavLink>
        ))}
        {profile?.role === 'admin' && (
          <>
            <div style={s.navSection}>Admin</div>
            <NavLink to="/admin"
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                ...s.navItem,
                background: isActive ? '#D4570A' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.52)',
              })}>
              <i className="ti ti-settings" style={{fontSize:17,flexShrink:0}} />
              Pannello admin
            </NavLink>
            <NavLink to="/importa"
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                ...s.navItem,
                background: isActive ? '#D4570A' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.52)',
              })}>
              <i className="ti ti-file-upload" style={{fontSize:17,flexShrink:0}} />
              Importa piano
            </NavLink>
          </>
        )}
      </div>
      <div style={s.footer}>
        <button style={s.logoutBtn} onClick={handleLogout}>
          <i className="ti ti-logout" style={{fontSize:15}} /> Esci
        </button>
        <div style={s.version}>v1.0</div>
      </div>
    </>
  )

  return (
    <div style={s.shell}>
      {!isMobile && (
        <div style={s.sidebar}><SidebarContent /></div>
      )}
      {isMobile && mobileOpen && (
        <>
          <div style={s.overlay} onClick={() => setMobileOpen(false)} />
          <div style={s.sidebarMobile}><SidebarContent /></div>
        </>
      )}
      <div style={s.main}>
        {isMobile && (
          <div style={{...s.mobilebar, display:'flex'}}>
            <button style={s.hamburger} onClick={() => setMobileOpen(true)}>
              <i className="ti ti-menu-2" />
            </button>
            <div style={{fontSize:17, fontWeight:500, color:'white', letterSpacing:-0.3}}>
              FO<span style={{color:'#D4570A'}}>fit</span>
            </div>
            <div style={{width:32}} />
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}
