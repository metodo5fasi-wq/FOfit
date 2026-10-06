import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px', WebkitOverflowScrolling:'touch' },
  card: { background:'white', borderRadius:12, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#888780', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #E0DDD6', borderRadius:8, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGreen: { background:'#3B6D11', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 },
  grid4: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 },
  statBox: (color='#D4570A') => ({ background:'#F5F3EF', borderRadius:10, padding:'12px', textAlign:'center' }),
  statVal: (color='#D4570A') => ({ fontSize:22, fontWeight:800, color, marginBottom:2 }),
  statLbl: { fontSize:9, color:'#888780', textTransform:'uppercase', letterSpacing:'0.07em' },
}

const initials = n => n ? n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() : '?'

function ScoreBar({ value, max=10, color='#D4570A' }) {
  const pct = Math.min(Math.round((value/max)*100), 100)
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{flex:1,height:6,background:'#F0EDE8',borderRadius:4,overflow:'hidden'}}>
        <div style={{height:6,width:`${pct}%`,background:color,borderRadius:4,transition:'width 0.3s'}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color,minWidth:24,textAlign:'right'}}>{value}</span>
    </div>
  )
}

export default function ReportPDF() {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [period, setPeriod] = useState('settimana')
  const [noteCoach, setNoteCoach] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,subscription_type,subscription_end')
      .eq('role','client').order('full_name')
      .then(({data})=>setClients(data||[]))
  }, [])

  async function fetchData() {
    if (!selectedClient) return
    setLoading(true)
    const days = period==='settimana'?7:period==='bisettimanale'?14:30
    const from = new Date(Date.now()-days*86400000).toISOString().split('T')[0]
    const to = new Date().toISOString().split('T')[0]
    const client = clients.find(c=>c.id===selectedClient)

    const [diaryRes, sessionsRes, measRes, checkinRes, adherenceRes, reportRes, profileRes] = await Promise.all([
      supabase.from('diary_entries').select('entry_date,kcal,protein_g,carbs_g,fat_g').eq('client_id',selectedClient).gte('entry_date',from).order('entry_date'),
      supabase.from('workout_sessions').select('*').eq('client_id',selectedClient).gte('session_date',from).order('session_date'),
      supabase.from('progress_entries').select('*').eq('client_id',selectedClient).order('entry_date',{ascending:false}).limit(3),
      supabase.from('weekly_checkins').select('*').eq('client_id',selectedClient).order('week_date',{ascending:false}).limit(2),
      supabase.from('meal_adherence').select('followed,adherence_date').eq('client_id',selectedClient).gte('adherence_date',from),
      supabase.from('workout_reports').select('*').eq('client_id',selectedClient).not('submitted_at','is',null).order('submitted_at',{ascending:false}).limit(1),
      supabase.from('profiles').select('*').eq('id',selectedClient).single(),
    ])

    const diary = diaryRes.data||[]
    const sessions = sessionsRes.data||[]
    const measures = measRes.data||[]
    const checkins = checkinRes.data||[]
    const adh = adherenceRes.data||[]
    const latestReport = reportRes.data?.[0]||null
    const fullProfile = profileRes.data

    // Peso
    const weight = {
      current: measures[0]?.weight_kg || null,
      prev: measures[1]?.weight_kg || null,
      diff: measures[0]?.weight_kg && measures[1]?.weight_kg
        ? Math.round((measures[0].weight_kg - measures[1].weight_kg)*10)/10
        : null,
      entries: measures.slice(0,3),
    }

    // Allenamento
    const totalSets = sessions.reduce((s,s2)=>s+(s2.sets_completed||0),0)
    const totalVolume = sessions.reduce((s,s2)=>s+(s2.total_volume_kg||0),0)
    const avgComp = sessions.length
      ? Math.round(sessions.reduce((s,s2)=>s+(s2.sets_total>0?s2.sets_completed/s2.sets_total:0),0)/sessions.length*100)
      : 0

    // Diario
    const avgKcal = diary.length ? Math.round(diary.reduce((s,d)=>s+(d.kcal||0),0)/diary.length) : 0
    const avgProt = diary.length ? Math.round(diary.reduce((s,d)=>s+(d.protein_g||0),0)/diary.length) : 0
    const avgCarbs = diary.length ? Math.round(diary.reduce((s,d)=>s+(d.carbs_g||0),0)/diary.length) : 0
    const avgFat = diary.length ? Math.round(diary.reduce((s,d)=>s+(d.fat_g||0),0)/diary.length) : 0

    // Aderenza
    const followed = adh.filter(a=>a.followed).length
    const adhPct = adh.length ? Math.round(followed/adh.length*100) : null

    // Checkin
    const checkin = checkins[0] || null

    setReportData({ client, fullProfile, period:{days,from,to}, weight, diary:{days:diary.length,avgKcal,avgProt,avgCarbs,avgFat,entries:diary}, training:{sessions:sessions.length,totalSets,totalVolume:Math.round(totalVolume),avgCompletion:avgComp,entries:sessions}, adherence:adh.length?{followed,total:adh.length,pct:adhPct}:null, checkin, latestReport })
    setLoading(false)
  }

  function colorForScore(v, inverse=false) {
    if (v===null||v===undefined) return '#888780'
    if (inverse) return v<=3?'#3B6D11':v<=6?'#E8A020':'#E24B4A'
    return v>=8?'#3B6D11':v>=5?'#E8A020':'#E24B4A'
  }

  function generatePDF() {
    const r = reportData
    const p = r.period
    const periodLabel = p.days===7?'Settimanale':p.days===14?'Bisettimanale':'Mensile'
    const fromDate = new Date(p.from+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    const toDate = new Date(p.to+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    const lr = r.latestReport
    const c = r.checkin

    function bar(val, max=10, color='#D4570A') {
      const pct = Math.min(Math.round((val/max)*100),100)
      return `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:5px;background:#F0EDE8;border-radius:3px"><div style="height:5px;width:${pct}%;background:${color};border-radius:3px"></div></div><span style="font-size:11px;font-weight:700;color:${color};min-width:20px;text-align:right">${val}</span></div>`
    }

    function scoreColor(v, inv=false) {
      if (v===null||v===undefined) return '#888780'
      if (inv) return v<=3?'#3B6D11':v<=6?'#E8A020':'#E24B4A'
      return v>=8?'#3B6D11':v>=5?'#E8A020':'#E24B4A'
    }

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Report ${periodLabel} — ${r.client.full_name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fff; color:#111; font-size:13px; }

  /* HEADER */
  .header { background:linear-gradient(135deg,#1A1A1A 0%,#2D2D2D 100%); color:white; padding:28px 36px 24px; }
  .header-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .brand { font-size:22px; font-weight:900; letter-spacing:-0.5px; }
  .brand span { color:#D4570A; }
  .header-meta { text-align:right; font-size:11px; opacity:0.7; line-height:1.6; }
  .client-row { display:flex; align-items:center; gap:14px; }
  .avatar { width:48px; height:48px; border-radius:50%; background:#D4570A; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:white; flex-shrink:0; }
  .client-name { font-size:20px; font-weight:800; }
  .client-sub { font-size:12px; opacity:0.7; margin-top:3px; }
  .period-badge { margin-left:auto; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:5px 14px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }

  /* LAYOUT */
  .body { padding:28px 36px; }
  .section { margin-bottom:26px; }
  .section-title { font-size:11px; font-weight:700; color:#D4570A; text-transform:uppercase; letter-spacing:0.1em; border-bottom:2px solid #FEF0E7; padding-bottom:6px; margin-bottom:14px; display:flex; align-items:center; gap:6px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }

  /* STAT BOXES */
  .stat { background:#F8F7F5; border-radius:10px; padding:14px 12px; text-align:center; border:0.5px solid #EEECE8; }
  .stat-val { font-size:26px; font-weight:900; margin-bottom:3px; line-height:1; }
  .stat-lbl { font-size:9px; color:#888780; text-transform:uppercase; letter-spacing:0.08em; }
  .stat-sub { font-size:10px; color:#BBB; margin-top:2px; }

  /* REPORT ALLENAMENTO */
  .report-section { background:#F8F7F5; border-radius:10px; padding:14px; margin-bottom:10px; border:0.5px solid #EEECE8; }
  .report-section h4 { font-size:11px; font-weight:700; color:#D4570A; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px; }
  .row-data { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:0.5px solid #EEECE8; font-size:12px; }
  .row-data:last-child { border-bottom:none; }
  .row-data .k { color:#888780; }
  .row-data .v { font-weight:600; color:#111; }

  /* TABELLA SESSIONI */
  .sessions-table { width:100%; border-collapse:collapse; font-size:11px; }
  .sessions-table th { background:#F0EDE8; padding:6px 10px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:#888780; }
  .sessions-table td { padding:7px 10px; border-bottom:0.5px solid #F5F3EF; }
  .sessions-table tr:last-child td { border-bottom:none; }
  .tag { display:inline-block; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:600; }
  .green { background:#EAF3DE; color:#3B6D11; }
  .orange { background:#FEF0E7; color:#D4570A; }
  .red { background:#FEE2E2; color:#E24B4A; }
  .gray { background:#F5F3EF; color:#888780; }

  /* DIARIO */
  .macro-row { display:flex; gap:10px; align-items:center; padding:5px 0; }
  .macro-label { font-size:11px; color:#888780; width:90px; flex-shrink:0; }
  .macro-bar-wrap { flex:1; }
  .macro-val { font-size:11px; font-weight:700; min-width:40px; text-align:right; }

  /* NOTE */
  .note-box { background:#FFF8F5; border:1px solid #FDDCC4; border-radius:10px; padding:14px; font-size:12px; line-height:1.7; color:#444; font-style:italic; }
  .coach-note { background:#F5F8FF; border:1px solid #D0DFFB; border-radius:10px; padding:14px; }

  /* FOOTER */
  .footer { margin-top:32px; padding:14px 36px; background:#F8F7F5; border-top:0.5px solid #EEECE8; display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#888780; }
  .footer strong { color:#D4570A; }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { display:none; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-top">
    <div class="brand">FO<span>fit</span></div>
    <div class="header-meta">Federico Obinu · Coach<br>fofit.fit</div>
  </div>
  <div class="client-row">
    <div class="avatar">${initials(r.client.full_name)}</div>
    <div>
      <div class="client-name">${r.client.full_name}</div>
      <div class="client-sub">Report ${periodLabel} · ${fromDate} – ${toDate}</div>
    </div>
    <div class="period-badge">${p.days} giorni</div>
  </div>
</div>

<div class="body">

  <!-- RIEPILOGO RAPIDO -->
  <div class="section">
    <div class="section-title">📊 Riepilogo periodo</div>
    <div class="grid4">
      <div class="stat">
        <div class="stat-val" style="color:${r.weight.diff!==null?(r.weight.diff<0?'#3B6D11':r.weight.diff>0?'#E24B4A':'#888780'):'#111'}">${r.weight.current?r.weight.current+'kg':'—'}</div>
        <div class="stat-lbl">Peso attuale</div>
        ${r.weight.diff!==null?`<div class="stat-sub" style="color:${r.weight.diff<0?'#3B6D11':'#E24B4A'}">${r.weight.diff>0?'+':''}${r.weight.diff}kg</div>`:''}
      </div>
      <div class="stat">
        <div class="stat-val" style="color:${r.training.avgCompletion>=80?'#3B6D11':r.training.avgCompletion>=50?'#E8A020':'#E24B4A'}">${r.training.sessions}</div>
        <div class="stat-lbl">Sessioni allenamento</div>
        <div class="stat-sub">${r.training.avgCompletion}% completamento</div>
      </div>
      <div class="stat">
        <div class="stat-val" style="color:${r.diary.days>=Math.round(p.days*0.8)?'#3B6D11':r.diary.days>=Math.round(p.days*0.5)?'#E8A020':'#E24B4A'}">${r.diary.days}/${p.days}</div>
        <div class="stat-lbl">Giorni diario</div>
        <div class="stat-sub">${r.diary.avgKcal} kcal medie</div>
      </div>
      <div class="stat">
        <div class="stat-val" style="color:${r.adherence?r.adherence.pct>=70?'#3B6D11':r.adherence.pct>=50?'#E8A020':'#E24B4A':'#888780'}">${r.adherence?r.adherence.pct+'%':'—'}</div>
        <div class="stat-lbl">Aderenza piano</div>
        ${r.adherence?`<div class="stat-sub">${r.adherence.followed}/${r.adherence.total} pasti</div>`:''}
      </div>
    </div>
  </div>

  <div class="grid2">
    <!-- COLONNA SINISTRA -->
    <div>

      <!-- REPORT ALLENAMENTO SOGGETTIVO -->
      ${lr ? `
      <div class="section">
        <div class="section-title">🏋️ Report allenamento (auto-compilato)</div>
        ${lr.benessere_generale!==null||lr.energia_allenamento!==null||lr.stress_periodo!==null?`
        <div class="report-section">
          <h4>Benessere e performance</h4>
          ${lr.benessere_generale!==null?`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">😊 Benessere generale</span><span style="font-weight:700;color:${scoreColor(lr.benessere_generale)}">${lr.benessere_generale}/10</span></div>${bar(lr.benessere_generale,10,scoreColor(lr.benessere_generale))}</div>`:''}
          ${lr.energia_allenamento!==null?`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">⚡ Energia in allenamento</span><span style="font-weight:700;color:${scoreColor(lr.energia_allenamento)}">${lr.energia_allenamento}/10</span></div>${bar(lr.energia_allenamento,10,scoreColor(lr.energia_allenamento))}</div>`:''}
          ${lr.stress_periodo!==null?`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">🧠 Stress periodo</span><span style="font-weight:700;color:${scoreColor(lr.stress_periodo,true)}">${lr.stress_periodo}/10</span></div>${bar(lr.stress_periodo,10,scoreColor(lr.stress_periodo,true))}</div>`:''}
          ${lr.qualita_recupero!==null?`<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">😴 Qualità recupero</span><span style="font-weight:700;color:${scoreColor(lr.qualita_recupero)}">${lr.qualita_recupero}/10</span></div>${bar(lr.qualita_recupero,10,scoreColor(lr.qualita_recupero))}</div>`:''}
        </div>` : ''}
        ${lr.sessioni_completate||lr.sessioni_pianificate?`
        <div class="report-section">
          <h4>Dati sessioni</h4>
          ${lr.sessioni_completate?`<div class="row-data"><span class="k">Sessioni completate</span><span class="v">${lr.sessioni_completate}${lr.sessioni_pianificate?'/'+lr.sessioni_pianificate:''}</span></div>`:''}
          ${lr.peso_inizio||lr.peso_fine?`<div class="row-data"><span class="k">Peso periodo</span><span class="v">${lr.peso_inizio||'—'}kg → ${lr.peso_fine||'—'}kg</span></div>`:''}
          ${lr.ore_sonno_medie?`<div class="row-data"><span class="k">Sonno medio</span><span class="v">${lr.ore_sonno_medie}h/notte</span></div>`:''}
        </div>` : ''}
        ${lr.difficolta_alimentazione?`<div class="note-box" style="margin-top:8px"><strong style="font-style:normal;color:#D4570A;font-size:10px;text-transform:uppercase;letter-spacing:0.06em">Difficoltà alimentazione</strong><br>${lr.difficolta_alimentazione}</div>`:''}
        ${lr.esercizi_amati||lr.esercizi_difficili?`
        <div class="report-section" style="margin-top:8px">
          <h4>Feedback esercizi</h4>
          ${lr.esercizi_amati?`<div class="row-data"><span class="k">✅ Amati</span><span class="v">${lr.esercizi_amati}</span></div>`:''}
          ${lr.esercizi_difficili?`<div class="row-data"><span class="k">😓 Difficili</span><span class="v">${lr.esercizi_difficili}</span></div>`:''}
          ${lr.cosa_cambieresti?`<div class="row-data"><span class="k">💡 Migliorare</span><span class="v">${lr.cosa_cambieresti}</span></div>`:''}
        </div>` : ''}
        ${lr.note_coach?`<div class="note-box" style="margin-top:8px"><strong style="font-style:normal;color:#D4570A;font-size:10px;text-transform:uppercase;letter-spacing:0.06em">Nota al coach</strong><br>${lr.note_coach}</div>`:''}
      </div>` : ''}

      <!-- SESSIONI ALLENAMENTO -->
      ${r.training.entries.length ? `
      <div class="section">
        <div class="section-title">📅 Sessioni completate</div>
        <table class="sessions-table">
          <thead><tr><th>Giorno</th><th>Data</th><th>Serie</th><th>Volume</th></tr></thead>
          <tbody>
            ${r.training.entries.map(s2=>{
              const comp = s2.sets_total>0?Math.round(s2.sets_completed/s2.sets_total*100):0
              return `<tr>
                <td style="font-weight:600">${s2.day_label||'Allenamento'}</td>
                <td style="color:#888780">${new Date(s2.session_date+'T12:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}</td>
                <td><span class="tag ${comp>=80?'green':comp>=50?'orange':'red'}">${s2.sets_completed||0}/${s2.sets_total||0}</span></td>
                <td style="color:#888780">${s2.total_volume_kg?Math.round(s2.total_volume_kg)+'kg':'—'}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
        <div style="display:flex;gap:12px;margin-top:10px;font-size:11px">
          <span style="color:#888780">Totale: <strong style="color:#111">${r.training.totalSets} serie</strong></span>
          ${r.training.totalVolume?`<span style="color:#888780">Volume: <strong style="color:#111">${r.training.totalVolume}kg</strong></span>`:''}
        </div>
      </div>` : ''}

    </div>

    <!-- COLONNA DESTRA -->
    <div>

      <!-- PESO -->
      ${r.weight.current ? `
      <div class="section">
        <div class="section-title">⚖️ Peso corporeo</div>
        <div class="grid2" style="margin-bottom:10px">
          <div class="stat">
            <div class="stat-val" style="color:#111">${r.weight.current}kg</div>
            <div class="stat-lbl">Peso attuale</div>
          </div>
          <div class="stat">
            <div class="stat-val" style="color:${r.weight.diff!==null?(r.weight.diff<0?'#3B6D11':r.weight.diff>0?'#E24B4A':'#888780'):'#888780'}">${r.weight.diff!==null?(r.weight.diff>0?'+':'')+r.weight.diff+'kg':'—'}</div>
            <div class="stat-lbl">Variazione</div>
          </div>
        </div>
        ${r.weight.entries.length>1?`
        <div style="font-size:10px;color:#888780;margin-top:6px">
          ${r.weight.entries.map(m=>`<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px solid #F0EDE8"><span>${new Date(m.entry_date+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span><span style="font-weight:600;color:#111">${m.weight_kg}kg</span></div>`).join('')}
        </div>` : ''}
      </div>` : ''}

      <!-- DIARIO ALIMENTARE -->
      <div class="section">
        <div class="section-title">🥗 Diario alimentare</div>
        <div class="grid2" style="margin-bottom:12px">
          <div class="stat">
            <div class="stat-val" style="color:${r.diary.days>=Math.round(p.days*0.8)?'#3B6D11':r.diary.days>=Math.round(p.days*0.5)?'#E8A020':'#E24B4A'}">${r.diary.days}/${p.days}</div>
            <div class="stat-lbl">Giorni compilati</div>
          </div>
          <div class="stat">
            <div class="stat-val" style="color:#D4570A">${r.diary.avgKcal}</div>
            <div class="stat-lbl">Kcal medie/giorno</div>
          </div>
        </div>
        ${r.diary.avgProt>0?`
        <div style="background:#F8F7F5;border-radius:8px;padding:12px">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#888780;margin-bottom:8px;font-weight:600">Media macronutrienti</div>
          ${[
            {l:'Proteine',v:r.diary.avgProt+'g',c:'#4A90D4'},
            {l:'Carboidrati',v:r.diary.avgCarbs+'g',c:'#E8A020'},
            {l:'Grassi',v:r.diary.avgFat+'g',c:'#3B8C5A'},
          ].map(m=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:0.5px solid #EEECE8"><span style="color:#888780">${m.l}</span><span style="font-weight:700;color:${m.c}">${m.v}</span></div>`).join('')}
        </div>` : ''}
        ${r.adherence?`
        <div style="margin-top:10px;background:${r.adherence.pct>=70?'#EAF3DE':r.adherence.pct>=50?'#FEF8E7':'#FEE2E2'};border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${r.adherence.pct>=70?'#3B6D11':r.adherence.pct>=50?'#E8A020':'#E24B4A'}">${r.adherence.pct}%</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#888780;margin-top:2px">Aderenza al piano · ${r.adherence.followed}/${r.adherence.total} pasti</div>
        </div>` : ''}
      </div>

      <!-- CHECK-IN SETTIMANALE -->
      ${c ? `
      <div class="section">
        <div class="section-title">✅ Check-in settimanale</div>
        <div style="background:#F8F7F5;border-radius:10px;padding:14px">
          ${c.energy_level!==null?`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">⚡ Energia</span><span style="font-weight:700;color:${scoreColor(c.energy_level)}">${c.energy_level}/5</span></div>${bar(c.energy_level,5,scoreColor(c.energy_level))}</div>`:''}
          ${c.sleep_quality!==null?`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">😴 Sonno</span><span style="font-weight:700;color:${scoreColor(c.sleep_quality)}">${c.sleep_quality}/5</span></div>${bar(c.sleep_quality,5,scoreColor(c.sleep_quality))}</div>`:''}
          ${c.stress_level!==null?`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">🧠 Stress</span><span style="font-weight:700;color:${scoreColor(c.stress_level,true)}">${c.stress_level}/5</span></div>${bar(c.stress_level,5,scoreColor(c.stress_level,true))}</div>`:''}
          ${c.motivation_level!==null?`<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:#888780">🔥 Motivazione</span><span style="font-weight:700;color:${scoreColor(c.motivation_level)}">${c.motivation_level}/5</span></div>${bar(c.motivation_level,5,scoreColor(c.motivation_level))}</div>`:''}
          ${c.notes?`<div style="margin-top:10px;padding:8px;background:white;border-radius:6px;font-size:11px;color:#555;font-style:italic;border:0.5px solid #EEECE8">"${c.notes}"</div>`:''}
        </div>
      </div>` : ''}

      <!-- NOTE COACH -->
      ${noteCoach ? `
      <div class="section">
        <div class="section-title">💬 Note del coach</div>
        <div class="coach-note">
          <div style="font-size:10px;font-weight:700;color:#4A90D4;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Federico Obinu · FOfit Coach</div>
          <div style="font-size:12px;line-height:1.7;color:#333">${noteCoach.replace(/\n/g,'<br>')}</div>
        </div>
      </div>` : ''}

    </div>
  </div>

</div>

<!-- FOOTER -->
<div class="footer">
  <span>Generato il <strong>${new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</strong></span>
  <span>FOfit · Federico Obinu Coach · <strong>fofit.fit</strong></span>
</div>

</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 800)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'#111'}}>Report PDF</div>
          <div style={{fontSize:11,color:'#888780'}}>Genera report professionale per il cliente</div>
        </div>
      </div>
      <div style={s.page}>

        {/* SELEZIONE */}
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
          <div style={{marginTop:10}}>
            <label style={s.label}>Note del coach (opzionali — appariranno nel PDF)</label>
            <textarea value={noteCoach} onChange={e=>setNoteCoach(e.target.value)}
              placeholder="Scrivi qui un commento personalizzato per il cliente..."
              style={{...s.input, minHeight:80, resize:'vertical', lineHeight:1.6}}/>
          </div>
          <div style={{marginTop:10,display:'flex',gap:8}}>
            <button onClick={fetchData} disabled={!selectedClient||loading} style={{...s.btn,flex:1,justifyContent:'center'}}>
              <i className="ti ti-refresh" style={{fontSize:14}}/>{loading?'Caricamento...':'Carica dati'}
            </button>
            {reportData && (
              <button onClick={generatePDF} style={{...s.btnGreen,justifyContent:'center'}}>
                <i className="ti ti-file-type-pdf" style={{fontSize:14}}/>Genera PDF
              </button>
            )}
          </div>
        </div>

        {/* ANTEPRIMA */}
        {reportData && (
          <>
            <div style={{fontSize:11,color:'#888780',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:600}}>
              Anteprima · {reportData.client.full_name}
            </div>

            {/* STATS RAPIDE */}
            <div style={{...s.grid4,marginBottom:12}}>
              {[
                {l:'Peso',v:reportData.weight.current?reportData.weight.current+'kg':'—',sub:reportData.weight.diff!==null?(reportData.weight.diff>0?'+':'')+reportData.weight.diff+'kg':null,c:reportData.weight.diff!==null?(reportData.weight.diff<0?'#3B6D11':reportData.weight.diff>0?'#E24B4A':'#888780'):'#111'},
                {l:'Sessioni',v:reportData.training.sessions,sub:reportData.training.avgCompletion+'% comp.',c:reportData.training.avgCompletion>=80?'#3B6D11':reportData.training.avgCompletion>=50?'#E8A020':'#E24B4A'},
                {l:'Kcal medie',v:reportData.diary.avgKcal||'—',sub:reportData.diary.days+'/'+reportData.period.days+' giorni',c:'#D4570A'},
                {l:'Aderenza',v:reportData.adherence?reportData.adherence.pct+'%':'—',sub:reportData.adherence?reportData.adherence.followed+'/'+reportData.adherence.total+' pasti':null,c:reportData.adherence?(reportData.adherence.pct>=70?'#3B6D11':reportData.adherence.pct>=50?'#E8A020':'#E24B4A'):'#888780'},
              ].map(st=>(
                <div key={st.l} style={s.statBox()}>
                  <div style={s.statVal(st.c)}>{st.v}</div>
                  <div style={s.statLbl}>{st.l}</div>
                  {st.sub && <div style={{fontSize:10,color:'#888780',marginTop:2}}>{st.sub}</div>}
                </div>
              ))}
            </div>

            {/* REPORT SOGGETTIVO */}
            {reportData.latestReport && (
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:'#7C3AED',marginBottom:10}}>📋 Report auto-compilato dal cliente</div>
                <div style={s.grid2}>
                  {[
                    {l:'😊 Benessere',v:reportData.latestReport.benessere_generale,c:'#3B6D11'},
                    {l:'⚡ Energia allenamento',v:reportData.latestReport.energia_allenamento,c:'#D4570A'},
                    {l:'🧠 Stress',v:reportData.latestReport.stress_periodo,inv:true},
                    {l:'😴 Recupero',v:reportData.latestReport.qualita_recupero,c:'#4A90D4'},
                  ].filter(i=>i.v!==null&&i.v!==undefined).map(item=>(
                    <div key={item.l}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                        <span style={{color:'#888780'}}>{item.l}</span>
                        <span style={{fontWeight:700,color:colorForScore(item.v,item.inv)}}>{item.v}/10</span>
                      </div>
                      <ScoreBar value={item.v} max={10} color={colorForScore(item.v,item.inv)}/>
                    </div>
                  ))}
                </div>
                {reportData.latestReport.note_coach && (
                  <div style={{marginTop:10,background:'#F5F3EF',borderRadius:8,padding:'10px 12px',fontSize:11,color:'#555',fontStyle:'italic',borderLeft:'3px solid #D4570A'}}>
                    "{reportData.latestReport.note_coach}"
                  </div>
                )}
              </div>
            )}

            {/* CHECK-IN */}
            {reportData.checkin && (
              <div style={s.card}>
                <div style={{fontSize:12,fontWeight:700,color:'#3B8C5A',marginBottom:10}}>✅ Check-in benessere</div>
                <div style={s.grid2}>
                  {[
                    {l:'⚡ Energia',v:reportData.checkin.energy_level,max:5},
                    {l:'😴 Sonno',v:reportData.checkin.sleep_quality,max:5},
                    {l:'🧠 Stress',v:reportData.checkin.stress_level,max:5,inv:true},
                    {l:'🔥 Motivazione',v:reportData.checkin.motivation_level,max:5},
                  ].filter(i=>i.v!==null&&i.v!==undefined).map(item=>(
                    <div key={item.l}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                        <span style={{color:'#888780'}}>{item.l}</span>
                        <span style={{fontWeight:700,color:colorForScore(item.v*2,item.inv)}}>{item.v}/5</span>
                      </div>
                      <ScoreBar value={item.v} max={5} color={colorForScore(item.v*2,item.inv)}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={generatePDF} style={{...s.btnGreen,width:'100%',justifyContent:'center',padding:'13px',fontSize:13}}>
              <i className="ti ti-file-type-pdf" style={{fontSize:16}}/>Genera e Stampa PDF
            </button>
          </>
        )}
      </div>
    </div>
  )
}
