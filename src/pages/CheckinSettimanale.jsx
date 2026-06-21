import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Toast } from '../components/Animations'

const s = {
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'16px', marginBottom:12 },
}

const LABELS = {
  energy: { label:'Energia', emoji:'⚡', desc:['Esausto','Stanco','Normale','Buona','Ottima'] },
  sleep: { label:'Sonno', emoji:'😴', desc:['Pessimo','Scarso','Discreto','Buono','Ottimo'] },
  stress: { label:'Stress', emoji:'🧘', desc:['Altissimo','Alto','Medio','Basso','Bassissimo'] },
}

// Lunedì della settimana corrente
function getWeekDate() {
  const d = new Date()
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export default function CheckinSettimanale() {
  const { profile } = useAuth()
  const [form, setForm] = useState({ energy:3, sleep:3, stress:3, notes:'' })
  const [history, setHistory] = useState([])
  const [existing, setExisting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({visible:false,message:''})
  const weekDate = getWeekDate()

  useEffect(() => {
    if (!profile) return
    supabase.from('weekly_checkins').select('*').eq('client_id', profile.id)
      .order('week_date', { ascending: false })
      .then(({ data }) => {
        setHistory(data||[])
        const thisWeek = data?.find(c => c.week_date === weekDate)
        if (thisWeek) { setExisting(thisWeek); setForm({ energy:thisWeek.energy, sleep:thisWeek.sleep, stress:thisWeek.stress, notes:thisWeek.notes||'' }) }
      })
  }, [profile])

  async function save() {
    setSaving(true)
    const payload = { client_id: profile.id, week_date: weekDate, ...form }
    if (existing) {
      await supabase.from('weekly_checkins').update(payload).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('weekly_checkins').insert(payload).select().single()
      setExisting(data)
    }
    setHistory(prev => {
      const filtered = prev.filter(c => c.week_date !== weekDate)
      return [{ ...payload, week_date: weekDate }, ...filtered]
    })
    setSaving(false)
    setToast({ visible:true, message:'Check-in salvato! 🙌' })
    setTimeout(() => setToast({visible:false,message:''}), 2000)
  }

  function ScaleInput({ field }) {
    const meta = LABELS[field]
    return (
      <div style={{marginBottom:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{meta.emoji} {meta.label}</div>
          <div style={{fontSize:12,color:'#D4570A',fontWeight:600}}>{meta.desc[form[field]-1]}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {[1,2,3,4,5].map(v => (
            <button key={v} onClick={()=>setForm(p=>({...p,[field]:v}))} style={{
              flex:1, height:40, borderRadius:9, border:'0.5px solid',
              background: form[field]===v ? '#D4570A' : 'var(--bg-input)',
              color: form[field]===v ? 'white' : 'var(--text-muted)',
              borderColor: form[field]===v ? '#D4570A' : 'var(--border)',
              fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit'
            }}>{v}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Check-in settimanale</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>
            Settimana del {new Date(weekDate+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})}
          </div>
        </div>
      </div>
      <div style={s.page}>

        <div style={s.card}>
          <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6,marginBottom:18}}>
            Come è andata questa settimana? Queste informazioni aiutano il tuo coach a capire il tuo stato generale e personalizzare meglio il percorso.
          </div>
          <ScaleInput field="energy"/>
          <ScaleInput field="sleep"/>
          <ScaleInput field="stress"/>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:8}}>📝 Note libere (opzionale)</div>
            <textarea
              value={form.notes}
              onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
              placeholder="Come ti sei sentito? Qualcosa da segnalare al coach?"
              rows={3}
              style={{width:'100%',padding:'10px 12px',border:'0.5px solid var(--border)',borderRadius:9,fontSize:13,color:'var(--text)',background:'var(--bg-input)',outline:'none',fontFamily:'inherit',resize:'none',lineHeight:1.5,boxSizing:'border-box'}}
            />
          </div>
          <button onClick={save} disabled={saving} style={{width:'100%',padding:13,background:'#D4570A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            <i className="ti ti-check" style={{fontSize:16}}/>{saving ? 'Salvataggio...' : existing ? 'Aggiorna check-in' : 'Invia check-in'}
          </button>
        </div>

        {/* STORICO */}
        {history.length > 1 && (
          <div style={s.card}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>Storico</div>
            {history.slice(0,8).map(c => (
              <div key={c.week_date} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}>
                <div style={{fontSize:11,color:'var(--text-muted)',width:80,flexShrink:0}}>
                  {new Date(c.week_date+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}
                </div>
                <div style={{display:'flex',gap:12,flex:1}}>
                  {['energy','sleep','stress'].map(f=>(
                    <div key={f} style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:12}}>{LABELS[f].emoji}</span>
                      <span style={{fontSize:13,fontWeight:700,color: c[f]>=4?'#3B6D11':c[f]<=2?'#D4570A':'var(--text)'}}>{c[f]}</span>
                    </div>
                  ))}
                </div>
                {c.notes && <i className="ti ti-notes" style={{fontSize:13,color:'var(--text-muted)'}}/>}
              </div>
            ))}
          </div>
        )}
      </div>
      <Toast visible={toast.visible} message={toast.message}/>
    </>
  )
}
