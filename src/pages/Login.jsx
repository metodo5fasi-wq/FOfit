import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o password non corretti. Contatta il tuo coach.')
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', background:'#111111' }}>
      <div style={{ background:'white', borderRadius:16, padding:'38px 34px', width:'100%', maxWidth:380, margin:'0 16px' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:30 }}>
          <div style={{ width:44, height:44, background:'#D4570A', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-bolt" style={{ color:'white', fontSize:22 }} />
          </div>
          <div>
            <div style={{ fontSize:22, fontWeight:500, color:'#111', letterSpacing:-0.5 }}>
              FO<span style={{ color:'#D4570A' }}>fit</span>
            </div>
            <div style={{ fontSize:10, color:'#888780', letterSpacing:'0.08em' }}>FOFIT.FIT</div>
          </div>
        </div>

        <div style={{ fontSize:17, fontWeight:500, color:'#111', marginBottom:4 }}>Bentornato</div>
        <div style={{ fontSize:13, color:'#888780', marginBottom:26, lineHeight:1.5 }}>
          Accedi per visualizzare il tuo piano personalizzato.
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="marco@email.com" required
              style={{ width:'100%', padding:'11px 13px', border:`0.5px solid ${error ? '#E24B4A' : '#E0DDD6'}`, borderRadius:8, fontSize:14, color:'#111', background:'#F5F3EF', outline:'none' }}
              onFocus={e => e.target.style.borderColor='#D4570A'}
              onBlur={e => e.target.style.borderColor=error?'#E24B4A':'#E0DDD6'}
            />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ width:'100%', padding:'11px 13px', border:`0.5px solid ${error ? '#E24B4A' : '#E0DDD6'}`, borderRadius:8, fontSize:14, color:'#111', background:'#F5F3EF', outline:'none' }}
              onFocus={e => e.target.style.borderColor='#D4570A'}
              onBlur={e => e.target.style.borderColor=error?'#E24B4A':'#E0DDD6'}
            />
          </div>

          {error && (
            <div style={{ background:'#FEE2E2', border:'0.5px solid #E24B4A', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#9B1C1C', marginBottom:12 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:12, background: loading ? '#E0DDD6' : '#D4570A', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:500, letterSpacing:'0.02em', transition:'background 0.15s' }}>
            {loading ? 'Accesso in corso...' : 'Accedi a FOfit'}
          </button>
        </form>

        <div style={{ fontSize:11, color:'#888780', textAlign:'center', marginTop:20, lineHeight:1.6 }}>
          Problemi di accesso? Contatta il tuo coach.<br />
          <a href="https://instagram.com/federicoobinu_coach" target="_blank" rel="noreferrer"
            style={{ color:'#D4570A', textDecoration:'none' }}>@federicoobinu_coach</a> su Instagram
        </div>
      </div>
    </div>
  )
}
