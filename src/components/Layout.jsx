import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const nav = [
  { to:'/', icon:'ti-layout-dashboard', label:'Dashboard', exact:true, color:'#F4894A' },
  { to:'/piano', icon:'ti-clipboard-list', label:'Piano alimentare', color:'#D4570A' },
  { to:'/diario', icon:'ti-pencil', label:'Diario', color:'#E8803A' },
  { to:'/progressi', icon:'ti-chart-line', label:'Progressi', color:'#3B8C5A' },
  { to:'/spesa', icon:'ti-shopping-cart', label:'Lista spesa', color:'#4A90D4' },
  { to:'/ai', icon:'ti-robot', label:'FO Coach AI', color:'#9B59B6' },
]

const adminNav = [
  { to:'/admin', icon:'ti-users', label:'Clienti', color:'#D4570A' },
  { to:'/importa', icon:'ti-file-upload', label:'Importa piano', color:'#F4894A' },
]

export default function Layout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = window.innerWidth < 768
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

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* LOGO */}
      <div style={{padding:'22px 20px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:11}}>
          <div style={{
            width:38, height:38, borderRadius:11,
            background:'linear-gradient(135deg, #D4570A 0%, #F4894A 100%)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 12px rgba(212,87,10,0.4)', flexShrink:0
          }}>
            <i className="ti ti-bolt" style={{color:'white',fontSize:19}}/>
          </div>
          <div>
            <div style={{fontSize:20,fontWeight:600,color:'white',letterSpacing:-0.5,lineHeight:1}}>
              FO<span style={{color:'#F4894A'}}>fit</span>
            </div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.25)',letterSpacing:'0.1em',marginTop:2}}>FOFIT.FIT</div>
          </div>
        </div>
      </div>

      {/* PROFILO UTENTE */}
      <div style={{padding:'14px 16px',margin:'12px 12px 4px',background:'rgba(255,255,255,0.05)',borderRadius:12,border:'0.5px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:40, height:40, borderRadius:'50%', flexShrink:0,
            background:'linear-gradient(135deg, #D4570A, #F4894A)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:600, color:'white',
            boxShadow:'0 2px 8px rgba(212,87,10,0.35)'
          }}>{initials}</div>
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

      {/* NAVIGAZIONE */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 8px'}}>

        <div style={{fontSize:9,letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',padding:'10px 10px 5px',textTransform:'uppercase'}}>
          Menu
        </div>

        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact}
            onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'9px 10px',
              borderRadius:9, marginBottom:2, textDecoration:'none', transition:'all 0.15s',
              background: isActive ? `linear-gradient(90deg, ${item.color}22, ${item.color}11)` : 'transparent',
              borderLeft: isActive ? `2.5px solid ${item.color}` : '2.5px solid transparent',
              color: isActive ? 'white' : 'rgba(255,255,255,0.48)',
            })}>
            <div style={{
              width:28, height:28, borderRadius:7, flexShrink:0,
              background: `${item.color}22`,
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>
              <i className={`ti ${item.icon}`} style={{fontSize:15,color:item.color}}/>
            </div>
            <span style={{fontSize:13,fontWeight:500}}>{item.label}</span>
            {item.to === '/ai' && (
              <span style={{marginLeft:'auto',fontSize:9,background:'linear-gradient(90deg,#9B59B6,#D4570A)',color:'white',padding:'2px 6px',borderRadius:10,fontWeight:600,letterSpacing:'0.05em'}}>AI</span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div style={{fontSize:9,letterSpacing:'0.12em',color:'rgba(255,255,255,0.22)',padding:'12px 10px 5px',textTransform:'uppercase'}}>
              Admin
            </div>
            {adminNav.map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:10, padding:'9px 10px',
                  borderRadius:9, marginBottom:2, textDecoration:'none', transition:'all 0.15s',
                  background: isActive ? `linear-gradient(90deg, ${item.color}22, ${item.color}11)` : 'transparent',
                  borderLeft: isActive ? `2.5px solid ${item.color}` : '2.5px solid transparent',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.48)',
                })}>
                <div style={{
                  width:28, height:28, borderRadius:7, flexShrink:0,
                  background:`${item.color}22`,
                  display:'flex', alignItems:'center', justifyContent:'center'
                }}>
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
        <button onClick={handleLogout} style={{
          display:'flex', alignItems:'center', gap:7, fontSize:12,
          color:'rgba(255,255,255,0.3)', cursor:'pointer', background:'none', border:'none',
          transition:'color 0.15s'
        }}>
          <i className="ti ti-logout" style={{fontSize:14}}/>
          Esci
        </button>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.15)'}}>v1.0</div>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden'}}>

      {/* SIDEBAR DESKTOP */}
      {!isMobile && (
        <div style={{width:230,background:'#0F0F0F',flexShrink:0,borderRight:'0.5px solid rgba(255,255,255,0.04)'}}>
          <SidebarContent/>
        </div>
      )}

      {/* SIDEBAR MOBILE OVERLAY */}
      {isMobile && mobileOpen && (
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:99,backdropFilter:'blur(4px)'}}
            onClick={()=>setMobileOpen(false)}/>
          <div style={{position:'fixed',left:0,top:0,bottom:0,zIndex:100,width:240,background:'#0F0F0F',boxShadow:'6px 0 30px rgba(0,0,0,0.5)'}}>
            <SidebarContent/>
          </div>
        </>
      )}

      {/* MAIN CONTENT */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#F5F3EF'}}>

        {/* TOPBAR MOBILE */}
        {isMobile && (
          <div style={{background:'#0F0F0F',padding:'0 16px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <button style={{background:'none',border:'none',color:'white',fontSize:22,display:'flex',alignItems:'center'}}
              onClick={()=>setMobileOpen(true)}>
              <i className="ti ti-menu-2"/>
            </button>
            <div style={{fontSize:18,fontWeight:600,color:'white',letterSpacing:-0.5}}>
              FO<span style={{color:'#F4894A'}}>fit</span>
            </div>
            <div style={{width:32}}/>
          </div>
        )}

        <Outlet/>
      </div>
    </div>
  )
}
