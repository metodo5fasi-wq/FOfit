import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnSm: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #D4570A', borderRadius:7, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
}

const initials = n => n ? n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() : '?'

export default function ReportPDF() {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [period, setPeriod] = useState('settimana')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,subscription_type,subscription_end').eq('role','client').order('full_name').then(({data})=>setClients(data||[]))
  }, [])

  async function fetchData() {
    if (!selectedClient) return
    setLoading(true)
    const days = period==='settimana'?7:period==='bisettimanale'?14:30
    const from = new Date(Date.now() - days*24*60*60*1000).toISOString().split('T')[0]
    const client = clients.find(c=>c.id===selectedClient)

    const [diaryRes, sessionsRes, measRes, checkinRes, adherenceRes] = await Promise.all([
      supabase.from('diary_entries').select('entry_date,kcal,protein_g,carbs_g,fat_g').eq('client_id',selectedClient).gte('entry_date',from).order('entry_date'),
      supabase.from('workout_sessions').select('*').eq('client_id',selectedClient).gte('session_date',from).order('session_date'),
      supabase.from('progress_entries').select('*').eq('client_id',selectedClient).order('entry_date',{ascending:false}).limit(2),
      supabase.from('weekly_checkins').select('*').eq('client_id',selectedClient).order('week_date',{ascending:false}).limit(2),
      supabase.from('meal_adherence').select('followed').eq('client_id',selectedClient).gte('adherence_date',from),
    ])

    const diary = diaryRes.data||[]
    const sessions = sessionsRes.data||[]
    const measures = measRes.data||[]
    const checkins = checkinRes.data||[]
    const adh = adherenceRes.data||[]

    setReportData({
      client,
      period: { days, from, to: new Date().toISOString().split('T')[0] },
      diary: {
        days: diary.length,
        avgKcal: diary.length ? Math.round(diary.reduce((s,d)=>s+(d.kcal||0),0)/diary.length) : 0,
        avgProtein: diary.length ? Math.round(diary.reduce((s,d)=>s+(d.protein_g||0),0)/diary.length) : 0,
        entries: diary,
      },
      training: {
        sessions: sessions.length,
        totalSets: sessions.reduce((s,s2)=>s+(s2.sets_completed||0),0),
        avgCompletion: sessions.length ? Math.round(sessions.reduce((s,s2)=>s+(s2.sets_total>0?(s2.sets_completed/s2.sets_total)*100:0),0)/sessions.length) : 0,
        entries: sessions,
      },
      weight: {
        current: measures[0]?.weight_kg||null,
        prev: measures[1]?.weight_kg||null,
        diff: measures[0]?.weight_kg && measures[1]?.weight_kg ? (measures[0].weight_kg - measures[1].weight_kg).toFixed(1) : null,
      },
      checkin: checkins[0]||null,
      adherence: adh.length ? { followed: adh.filter(a=>a.followed).length, total: adh.length, pct: Math.round(adh.filter(a=>a.followed).length/adh.length*100) } : null,
    })
    setLoading(false)
  }

  function generatePDF() {
    if (!reportData) return
    const { client, period: p, diary, training, weight, checkin, adherence } = reportData
    const periodLabel = { settimana:'Settimanale', bisettimanale:'Bisettimanale', mensile:'Mensile' }[period]
    const fromDate = new Date(p.from+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})
    const toDate = new Date(p.to+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: white; padding: 0; }
  .header { background: linear-gradient(135deg, #D4570A, #F4894A); color: white; padding: 28px 32px; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .header p { font-size: 13px; opacity: 0.85; }
  .content { padding: 24px 32px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: 700; color: #D4570A; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #FEF0E7; padding-bottom: 6px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .stat { background: #F5F3EF; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .value { font-size: 24px; font-weight: 800; color: #D4570A; }
  .stat .label { font-size: 10px; color: #888780; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 0.5px solid #F5F3EF; font-size: 12px; }
  .row strong { color: #111; }
  .tag { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .green { background: #EAF3DE; color: #3B6D11; }
  .orange { background: #FEF0E7; color: #D4570A; }
  .red { background: #FEE2E2; color: #E24B4A; }
  .footer { margin-top: 32px; padding: 16px 32px; background: #F5F3EF; font-size: 11px; color: #888780; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Report ${periodLabel}</h1>
      <p>${client.full_name} · ${fromDate} – ${toDate}</p>
    </div>
    <div style="text-align:right;font-size:12px;opacity:0.85">
      <div style="font-weight:700;font-size:16px">FOfit</div>
      <div>Federico Obinu · Coach</div>
    </div>
  </div>
</div>
<div class="content">

  ${weight.current ? `
  <div class="section">
    <div class="section-title">Peso corporeo</div>
    <div class="grid">
      <div class="stat"><div class="value">${weight.current}kg</div><div class="label">Peso attuale</div></div>
      <div class="stat"><div class="value" style="color:${weight.diff<0?'#3B6D11':weight.diff>0?'#E24B4A':'#888780'}">${weight.diff!==null?(weight.diff>0?'+':'')+weight.diff+'kg':'—'}</div><div class="label">Variazione</div></div>
      <div class="stat"><div class="value">${weight.prev||'—'}${weight.prev?'kg':''}</div><div class="label">Rilevazione precedente</div></div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Allenamento</div>
    <div class="grid">
      <div class="stat"><div class="value">${training.sessions}</div><div class="label">Sessioni completate</div></div>
      <div class="stat"><div class="value">${training.totalSets}</div><div class="label">Serie totali</div></div>
      <div class="stat"><div class="value" style="color:${training.avgCompletion>=80?'#3B6D11':training.avgCompletion>=50?'#E8A020':'#E24B4A'}">${training.avgCompletion}%</div><div class="label">Completamento medio</div></div>
    </div>
    ${training.entries.length ? `
    <div style="margin-top:12px">
      ${training.entries.map(s2=>`
      <div class="row">
        <strong>${s2.day_label||'Allenamento'}</strong>
        <span>${new Date(s2.session_date+'T12:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'short'})}</span>
        <span class="tag ${s2.sets_total>0&&s2.sets_completed/s2.sets_total>=0.8?'green':'orange'}">${s2.sets_completed}/${s2.sets_total} serie</span>
      </div>`).join('')}
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Diario alimentare</div>
    <div class="grid">
      <div class="stat"><div class="value">${diary.days}/${p.days}</div><div class="label">Giorni compilati</div></div>
      <div class="stat"><div class="value">${diary.avgKcal}</div><div class="label">Kcal medie</div></div>
      <div class="stat"><div class="value">${diary.avgProtein}g</div><div class="label">Proteine medie</div></div>
    </div>
    ${adherence ? `
    <div style="margin-top:12px">
      <div class="row"><strong>Aderenza al piano</strong><span class="tag ${adherence.pct>=70?'green':adherence.pct>=50?'orange':'red'}">${adherence.followed}/${adherence.total} pasti seguiti (${adherence.pct}%)</span></div>
    </div>` : ''}
  </div>

  ${checkin ? `
  <div class="section">
    <div class="section-title">Check-in benessere</div>
    <div class="grid">
      <div class="stat"><div class="value" style="color:${checkin.energy>=4?'#3B6D11':checkin.energy<=2?'#E24B4A':'#111'}">${checkin.energy}/5</div><div class="label">⚡ Energia</div></div>
      <div class="stat"><div class="value" style="color:${checkin.sleep>=4?'#3B6D11':checkin.sleep<=2?'#E24B4A':'#111'}">${checkin.sleep}/5</div><div class="label">😴 Sonno</div></div>
      <div class="stat"><div class="value" style="color:${checkin.stress<=2?'#3B6D11':checkin.stress>=4?'#E24B4A':'#111'}">${checkin.stress}/5</div><div class="label">🧘 Stress</div></div>
    </div>
    ${checkin.notes?`<div style="margin-top:10px;background:#F5F3EF;border-radius:8px;padding:10px 12px;font-size:12px;color:#555;font-style:italic">"${checkin.notes}"</div>`:''}
  </div>` : ''}

</div>
<div class="footer">
  <span>Generato il ${new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</span>
  <span>FOfit · Federico Obinu Coach · fofit.fit</span>
</div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#111'}}>Report PDF</div>
          <div style={{fontSize:12,color:'#888780'}}>Genera report stampabile per il cliente</div>
        </div>
      </div>
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Cliente</label>
              <select style={s.select} value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
                <option value="">Seleziona cliente...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Periodo</label>
              <select style={s.select} value={period} onChange={e=>setPeriod(e.target.value)}>
                <option value="settimana">Ultima settimana (7 giorni)</option>
                <option value="bisettimanale">Ultime 2 settimane</option>
                <option value="mensile">Ultimo mese (30 giorni)</option>
              </select>
            </div>
          </div>
          <div style={{marginTop:12,display:'flex',gap:8}}>
            <button onClick={fetchData} disabled={!selectedClient||loading} style={{...s.btn,flex:1,justifyContent:'center'}}>
              <i className="ti ti-refresh" style={{fontSize:14}}/>{loading?'Caricamento...':'Carica dati'}
            </button>
            {reportData && (
              <button onClick={generatePDF} style={{...s.btn,background:'#3B6D11',justifyContent:'center'}}>
                <i className="ti ti-file-type-pdf" style={{fontSize:14}}/>Stampa / Salva PDF
              </button>
            )}
          </div>
        </div>

        {/* ANTEPRIMA */}
        {reportData && (
          <>
            <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:600}}>Anteprima report</div>

            {/* Peso */}
            {reportData.weight.current && (
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:10}}>⚖️ Peso corporeo</div>
                <div style={{display:'flex',gap:16}}>
                  <div style={{textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:'#111'}}>{reportData.weight.current}kg</div><div style={{fontSize:10,color:'#888780'}}>Attuale</div></div>
                  {reportData.weight.diff !== null && <div style={{textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:reportData.weight.diff<0?'#3B6D11':'#E24B4A'}}>{reportData.weight.diff>0?'+':''}{reportData.weight.diff}kg</div><div style={{fontSize:10,color:'#888780'}}>Variazione</div></div>}
                </div>
              </div>
            )}

            {/* Allenamento */}
            <div style={s.card}>
              <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:10}}>🏋️ Allenamento</div>
              <div style={{display:'flex',gap:20}}>
                <div><div style={{fontSize:22,fontWeight:800,color:'#111'}}>{reportData.training.sessions}</div><div style={{fontSize:10,color:'#888780'}}>Sessioni</div></div>
                <div><div style={{fontSize:22,fontWeight:800,color:reportData.training.avgCompletion>=80?'#3B6D11':'#D4570A'}}>{reportData.training.avgCompletion}%</div><div style={{fontSize:10,color:'#888780'}}>Completamento</div></div>
              </div>
            </div>

            {/* Diario */}
            <div style={s.card}>
              <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:10}}>📋 Diario alimentare</div>
              <div style={{display:'flex',gap:20}}>
                <div><div style={{fontSize:22,fontWeight:800,color:'#111'}}>{reportData.diary.days}/{reportData.period.days}</div><div style={{fontSize:10,color:'#888780'}}>Giorni</div></div>
                <div><div style={{fontSize:22,fontWeight:800,color:'#111'}}>{reportData.diary.avgKcal}</div><div style={{fontSize:10,color:'#888780'}}>Kcal medie</div></div>
                {reportData.adherence && <div><div style={{fontSize:22,fontWeight:800,color:reportData.adherence.pct>=70?'#3B6D11':'#D4570A'}}>{reportData.adherence.pct}%</div><div style={{fontSize:10,color:'#888780'}}>Aderenza</div></div>}
              </div>
            </div>

            {/* Check-in */}
            {reportData.checkin && (
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:'#D4570A',marginBottom:10}}>✅ Check-in benessere</div>
                <div style={{display:'flex',gap:20}}>
                  {[{l:'⚡ Energia',v:reportData.checkin.energy},{l:'😴 Sonno',v:reportData.checkin.sleep},{l:'🧘 Stress',v:reportData.checkin.stress}].map(i=>(
                    <div key={i.l}><div style={{fontSize:22,fontWeight:800,color:'#111'}}>{i.v}/5</div><div style={{fontSize:10,color:'#888780'}}>{i.l}</div></div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={generatePDF} style={{...s.btn,width:'100%',justifyContent:'center',background:'#3B6D11',padding:'13px'}}>
              <i className="ti ti-file-type-pdf" style={{fontSize:16}}/>Genera e Stampa PDF
            </button>
          </>
        )}
      </div>
    </>
  )
}
