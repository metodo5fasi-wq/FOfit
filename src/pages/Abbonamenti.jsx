import React, { useState, useEffect, useRef } from 'react'
import { done, notify } from '../lib/toast'
import { localDateStr } from '../lib/dates'
import { dbMust, dbSave } from '../lib/db'
import { supabase } from '../lib/supabase'
import { askConfirm } from '../lib/confirm'
import { fetchAllRows } from '../lib/pagedQuery'
import { Link } from 'react-router-dom'
import EconomyPanel from '../components/EconomyPanel'
import IncassoForm from '../components/IncassoForm'
import { planPaymentSync, paidForSubscription, missingPrices, isMissingEconomy, kindLabel } from '../lib/ledger'
import { num, MAX_RATE, addMonths, addDays, effectiveDue, rateState, generateRates, validateRates, planRates, ratesTotal, ratesPaid, coachBadge, usesProroga, isMissingProrogaColumn, MISSING_PROROGA_MSG, fmtDate, money, GRACE_DAYS } from '../lib/installments'

const s = {
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px', WebkitOverflowScrolling:'touch' },
  card: { background:'#0D0D0D', borderRadius:12, border:'0.5px solid #1C1C1C', padding:'16px', marginBottom:12 },
  label: { fontSize:11, color:'#CCC', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #1C1C1C', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #1C1C1C', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnSm: { background:'rgba(212,87,10,0.12)', color:'#F4894A', border:'0.5px solid #D4570A', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#161616', color:'#CCC', border:'0.5px solid #1C1C1C', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' },
  btnGreen: { background:'rgba(59,140,90,0.12)', color:'#6FCF97', border:'0.5px solid #3B6D11', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  badge: { fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:600 },
}

const TIPI = ['Mensile','Trimestrale','Semestrale','Annuale','Pacchetto sedute','Altro']
const initials = n => n ? n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'

function daysLeft(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / 86400000)
}

function StatusBadge({ days }) {
  if (days === null) return <span style={{...s.badge, background:'#161616', color:'#CCC'}}>Non impostato</span>
  if (days < 0) return <span style={{...s.badge, background:'rgba(226,75,74,0.12)', color:'#E24B4A'}}>Scaduto {Math.abs(days)}gg fa</span>
  if (days <= 4) return <span style={{...s.badge, background:'rgba(226,75,74,0.12)', color:'#E24B4A'}}>⚠ Scade in {days}gg</span>
  if (days <= 7) return <span style={{...s.badge, background:'rgba(212,87,10,0.12)', color:'#F4894A'}}>⚠ Scade in {days}gg</span>
  if (days <= 30) return <span style={{...s.badge, background:'rgba(232,160,32,0.1)', color:'#E8A020'}}>Scade in {days}gg</span>
  return <span style={{...s.badge, background:'rgba(59,140,90,0.12)', color:'#6FCF97'}}>✓ Attivo ({days}gg)</span>
}

export default function Abbonamenti() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [installments, setInstallments] = useState([])          // le rate in modifica (ognuna ha _k, e id se già salvata)
  const [allRates, setAllRates] = useState({})                     // rate di tutti i clienti, per i badge in lista
  const [firstDate, setFirstDate] = useState('')                  // scadenza della prima rata
  const [prorogaOpen, setProrogaOpen] = useState(null)
  const keyN = useRef(0)
  const withKey = r => ({ ...r, _k: ++keyN.current })
  const [saving, setSaving] = useState(false)
  const [editReady, setEditReady] = useState(false)               // le rate del cliente aperto sono state lette
  const openTok = useRef(0)
  const [eco, setEco] = useState({ ready: false, payments: [], priceList: [] })   // prezzi e incassi (servono le tabelle di fofit-economia.sql)
  const [incassoOpen, setIncassoOpen] = useState(false)
  const today = localDateStr()

  useEffect(() => { fetchClients() }, [])

  async function loadEco() {
    const pay = await fetchAllRows(() => supabase.from('payments').select('*').order('paid_on', { ascending: false }).order('id'), { maxRows: 20000 })
    if (pay.error) { setEco({ ready: false, payments: [], priceList: [] }); return false }
    const pl = await supabase.from('price_list').select('*').eq('active', true).order('sort').order('name')
    setEco({ ready: true, payments: pay.data || [], priceList: pl.data || [] })
    return true
  }

  async function fetchClients() {
    setLoading(true)
    const COLS = 'id,full_name,subscription_start,subscription_end,subscription_type,subscription_notes,payment_type,installments,installment_amount,installments_paid'
    let { data, error: e1 } = await supabase.from('profiles').select(COLS + ',price_agreed,price_note').eq('role','client').order('full_name')
    if (e1 && isMissingEconomy(e1)) ({ data } = await supabase.from('profiles').select(COLS).eq('role','client').order('full_name'))   // script economia non ancora eseguito: tutto il resto funziona
    setClients(data||[])
    await loadEco()
    const { data: rr } = await fetchAllRows(() => supabase.from('subscription_installments').select('*').order('due_date').order('id'), { maxRows: 10000 })
    const by = {}; (rr||[]).forEach(r => { (by[r.client_id] = by[r.client_id] || []).push(r) })
    setAllRates(by)
    setLoading(false)
    // Notifiche automatiche scadenza
    if (data) sendExpiryNotifications(data)
  }

  async function sendExpiryNotifications(list) {
    for (const c of list) {
      const days = daysLeft(c.subscription_end)
      if (days === 4) {
        const { data: ex } = await supabase.from('notifications')
          .select('id').eq('client_id',c.id).eq('type','subscription_expiring')
          .gte('created_at', new Date(Date.now()-2*86400000).toISOString())
        if (!ex?.length) await dbSave(supabase.from('notifications').insert({
          client_id:c.id, type:'subscription_expiring',
          title:'⚠️ Abbonamento in scadenza',
          body:`Il tuo abbonamento scadrà tra 4 giorni. Contatta il coach per il rinnovo.`
        }), 'la notifica', 'salvare', { silent: true })
      }
      if (days !== null && days <= 0 && days >= -7) {      // come l'invio automatico: una sola volta per scadenza, solo nei 7 giorni dopo
        const { data: ex } = await supabase.from('notifications')
          .select('id').eq('client_id',c.id).eq('type','subscription_expired')
          .gte('created_at', c.subscription_end)
        if (!ex?.length) await dbSave(supabase.from('notifications').insert({
          client_id:c.id, type:'subscription_expired',
          title:'🔒 Abbonamento scaduto',
          body:`Il tuo abbonamento è scaduto. Contatta il coach per rinnovare l'accesso.`
        }), 'la notifica', 'salvare', { silent: true })
      }
    }
  }

  async function openEdit(c) {
    setProrogaOpen(null); setEditReady(false)
    const token = ++openTok.current
    // il pannello si apre subito con i dati del cliente; «Salva» resta spento finché non sono lette anche le rate
    setForm({
      subscription_start: c.subscription_start||'',
      subscription_end: c.subscription_end||'',
      subscription_type: c.subscription_type||'Mensile',
      subscription_notes: c.subscription_notes||'',
      payment_type: c.payment_type||'unica',
      installments: c.installments || 2,
      installment_amount: c.installment_amount ?? '',
      price_agreed: c.price_agreed ?? '',
      price_note: c.price_note || '',
    })
    setIncassoOpen(false)
    setInstallments([]); setFirstDate(c.subscription_start||''); setEditing(c.id)
    const { data, error } = await supabase.from('subscription_installments').select('*').eq('client_id',c.id).order('due_date')
    if (token !== openTok.current) return                                   // nel frattempo si è aperto un altro cliente
    if (error || !Array.isArray(data)) { notify('Non riesco a leggere le rate di questo cliente: riprova', 'error'); setEditing(null); return }
    const rows = data.map(withKey)
    setInstallments(rows)
    setFirstDate(rows[0]?.due_date ? String(rows[0].due_date).slice(0,10) : (c.subscription_start||''))
    setForm(p => ({ ...p, installments: rows.length || p.installments, installment_amount: rows[0]?.amount ?? p.installment_amount }))
    setEditReady(true)
  }

  // Numero di rate libero (1–36): si aggiungono in coda (un mese dopo l'ultima) o si tolgono dalla coda, mai quelle già pagate
  function setCount(n) {
    n = Math.max(1, Math.min(MAX_RATE, Math.round(n) || 1))
    setInstallments(prev => {
      if (n > prev.length) {
        const out = [...prev]
        while (out.length < n) {
          const last = out[out.length-1], base = last?.due_date ? String(last.due_date).slice(0,10) : firstDate
          out.push(withKey({ due_date: base ? (last ? addMonths(base,1) : base) : '', amount: num(last?.amount ?? form.installment_amount), paid_at: null, extended_until: null }))
        }
        return out
      }
      const out = [...prev]
      while (out.length > n) { const i = out.map(r=>!r.paid_at).lastIndexOf(true); if (i < 0) break; out.splice(i,1) }
      return out
    })
    setForm(p=>({...p, installments:n}))
  }
  const patchRate = (k, patch) => setInstallments(prev => prev.map(r => r._k===k ? {...r, ...patch} : r))
  const removeRate = k => { setInstallments(prev => prev.filter(r => r._k!==k)); setForm(p=>({...p, installments:Math.max(1,installments.length-1)})) }

  async function regenerate() {
    if (!firstDate || !(num(form.installment_amount) > 0)) { notify('Inserisci la scadenza della prima rata e l\'importo', 'error'); return }
    if (installments.some(r=>!r.paid_at) && !(await askConfirm('Le rate non ancora pagate verranno ricreate con scadenze mensili e lo stesso importo (le pagate restano). Vuoi continuare?', { title:'Rigenerare le scadenze?', confirmLabel:'Rigenera' }))) return
    setInstallments(generateRates({ count: form.installments, amount: form.installment_amount, firstDate, existing: installments.filter(r=>r.paid_at) }).map(r=>r._k?r:withKey(r)))
  }
  const markPaid = k => patchRate(k, { paid_at: new Date().toISOString() })
  const unmarkPaid = k => patchRate(k, { paid_at: null })
  function prorogate(r, days) {
    const from = effectiveDue(r) > today ? effectiveDue(r) : today
    patchRate(r._k, { extended_until: addDays(from, days) })
  }

  async function save() {
    if (saving || !editReady) return
    const isRate = form.payment_type==='rate'
    if (isRate) {
      const problems = validateRates(installments)
      if (problems.length) { notify(problems[0] + (problems.length>1 ? ` (+${problems.length-1} altri)` : ''), 'error'); return }
    }
    setSaving(true)
    try {
      const { data: dbRows, error: e0 } = await supabase.from('subscription_installments').select('*').eq('client_id', editing)
      if (e0) throw new Error('Non riesco a leggere le rate: riprova')
      let plan = { toInsert:[], toUpdate:[], toDelete:[] }
      if (isRate) {
        if (!installments.length && (dbRows||[]).length && !(await askConfirm('Non è rimasta nessuna rata: quelle già salvate di questo cliente verranno eliminate. Continuare?', { title:'Eliminare tutte le rate?', confirmLabel:'Elimina le rate', danger:true }))) { setSaving(false); return }
        plan = planRates({ clientId: editing, dbRows: dbRows||[], rows: installments })
      }
      else if ((dbRows||[]).length) {
        if (!(await askConfirm('Passando a "soluzione unica" le rate di questo cliente verranno eliminate. Continuare?', { title:'Eliminare le rate?', confirmLabel:'Elimina le rate', danger:true }))) { setSaving(false); return }
        plan.toDelete = dbRows.map(r=>r.id)
      }
      // prima si scrive, per ULTIMO si elimina: se qualcosa va storto a metà non si perde nulla
      try {
        if (plan.toInsert.length) await dbMust(supabase.from('subscription_installments').insert(plan.toInsert), 'le rate', 'salvare')
        for (let k = 0; k < plan.toUpdate.length; k += 8)
          await Promise.all(plan.toUpdate.slice(k,k+8).map(({id,...p}) => dbMust(supabase.from('subscription_installments').update(p).eq('id',id), 'le rate', 'salvare')))
      } catch(e) { if (isMissingProrogaColumn(e?.cause || e)) throw new Error(MISSING_PROROGA_MSG); throw e }
      if (plan.toDelete.length) await dbMust(supabase.from('subscription_installments').delete().in('id', plan.toDelete), 'le rate', 'eliminare')

      const price = eco.ready ? { price_agreed: num(form.price_agreed) > 0 ? num(form.price_agreed) : null, price_note: (form.price_note||'').trim() || null } : {}
      await dbMust(supabase.from('profiles').update({
        ...price,
        subscription_start: form.subscription_start||null,
        subscription_end: form.subscription_end||null,
        subscription_type: form.subscription_type,
        subscription_notes: form.subscription_notes||null,
        payment_type: form.payment_type||'unica',
        installments: isRate ? installments.length : 1,
        installment_amount: isRate ? (num(installments[0]?.amount)||null) : null,
        installments_paid: isRate ? installments.filter(r=>r.paid_at).length : null,
      }).eq('id', editing), 'i dati del cliente', 'salvare')

      // le rate pagate entrano nel registro incassi (e quelle tornate «non pagate» ne escono)
      let syncFailed = false
      if (eco.ready && isRate) {
        try {
          const [{ data: rr, error: e1 }, { data: pp, error: e2 }] = await Promise.all([
            supabase.from('subscription_installments').select('*').eq('client_id', editing),
            supabase.from('payments').select('*').eq('client_id', editing).eq('kind', 'rata')])
          if (e1 || e2) throw new Error('lettura')
          const cl = clients.find(c => c.id === editing) || { id: editing }
          const sp = planPaymentSync({ client: cl, rates: rr||[], payments: (pp||[]).filter(x => x.installment_id != null) })
          if (sp.toInsert.length) await dbMust(supabase.from('payments').insert(sp.toInsert), 'gli incassi', 'salvare')
          for (const u of sp.toUpdate) await dbMust(supabase.from('payments').update({ amount: u.amount }).eq('id', u.id), 'gli incassi', 'salvare')
          if (sp.toDelete.length) await dbMust(supabase.from('payments').delete().in('id', sp.toDelete), 'gli incassi', 'eliminare')
        } catch { syncFailed = true }
      }
      setEditing(null)
      fetchClients()
      if (syncFailed) notify('Abbonamento salvato, ma il registro incassi non è stato aggiornato: riapri il cliente e salva di nuovo.', 'error')
      else done('Abbonamento salvato')
    } catch(e) { notify(e.message || 'Salvataggio non riuscito. Riprova.', 'error') }
    setSaving(false)
  }

  async function addIncasso(payload) {
    const r = await dbSave(supabase.from('payments').insert(payload), 'l\'incasso', 'salvare', { done: 'Incasso registrato' })
    if (!r.ok) return false
    setIncassoOpen(false); await loadEco(); return true
  }
  async function removeIncasso(p) {
    if (!(await askConfirm(`Eliminare l'incasso di ${money(p.amount)} del ${fmtDate(p.paid_on)}?`, { title: 'Eliminare l\'incasso?', confirmLabel: 'Elimina', danger: true }))) return
    const r = await dbSave(supabase.from('payments').delete().eq('id', p.id), 'l\'incasso', 'eliminare')
    if (r.ok) await loadEco()
  }

  async function renew(c) {
    if (!c.subscription_end || !c.subscription_type) return
    const end = new Date(c.subscription_end)
    const days = {Mensile:30,Trimestrale:90,Semestrale:180,Annuale:365}[c.subscription_type]||30
    end.setDate(end.getDate()+days)
    await dbSave(supabase.from('profiles').update({
      subscription_start: c.subscription_end,
      subscription_end: end.toISOString().split('T')[0],
    }).eq('id',c.id), 'i dati del cliente', 'salvare', { done: 'Abbonamento rinnovato' })
    await dbSave(supabase.from('notifications').insert({
      client_id:c.id, type:'subscription_renewed',
      title:'✅ Abbonamento rinnovato',
      body:`Il tuo abbonamento è stato rinnovato fino al ${end.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}.`
    }), 'la notifica', 'salvare', { silent: true })
    fetchClients()
  }

  const scaduti = clients.filter(c=>c.subscription_end && c.subscription_end < today)
  const inScadenza = clients.filter(c=>{ const d=daysLeft(c.subscription_end); return d!==null&&d>=0&&d<=7 })
  const rateAlerts = clients.map(c=>({c,b:c.payment_type==='rate'?coachBadge(allRates[c.id]||[],today):null})).filter(x=>x.b)
  const attivi = clients.filter(c=>{ const d=daysLeft(c.subscription_end); return d!==null&&d>7 })

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'#F0F0F0'}}>Abbonamenti</div>
          <div style={{fontSize:11,color:'#CCC'}}>{clients.length} clienti · {attivi.length} attivi · {scaduti.length} scaduti</div>
        </div>
      </div>

      <div style={s.page}>
        {/* ALERT */}
        {(scaduti.length>0||inScadenza.length>0) && (
          <div style={{background:'rgba(212,87,10,0.12)',border:'0.5px solid #D4570A',borderRadius:12,padding:'12px',marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:'#F4894A',marginBottom:8}}>
              {scaduti.length>0&&`${scaduti.length} scadut${scaduti.length>1?'i':'o'}`}
              {scaduti.length>0&&inScadenza.length>0&&' · '}
              {inScadenza.length>0&&`${inScadenza.length} in scadenza entro 7 giorni`}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[...scaduti,...inScadenza].map(c=>(
                <div key={c.id} style={{background:'#0D0D0D',borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,fontWeight:600}}>{c.full_name}</span>
                  <StatusBadge days={daysLeft(c.subscription_end)}/>
                  <button onClick={()=>renew(c)} style={s.btnSm}>↻ Rinnova</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {rateAlerts.length>0 && (
          <div data-testid="riepilogo-rate" style={{background:'rgba(232,160,32,0.1)',border:'0.5px solid rgba(232,160,32,0.4)',borderRadius:12,padding:'12px',marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:'#E8A020',marginBottom:8}}>💳 Rate da seguire: {rateAlerts.length}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {rateAlerts.map(({c,b})=>(
                <div key={c.id} style={{background:'#0D0D0D',borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,fontWeight:600}}>{c.full_name}</span>
                  <span style={{fontSize:10,fontWeight:700,color:b.level==='soon'?'#E8A020':'#E24B4A'}}>{b.text}</span>
                  <button onClick={()=>openEdit(c)} style={s.btnSm}>Apri</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {eco.ready && clients.length > 0 && missingPrices(clients).length > 0 && (
          <div data-testid="banner-prezzi" style={{background:'rgba(212,87,10,0.12)',border:'0.5px solid #D4570A',borderRadius:12,padding:'12px',marginBottom:14,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#F4894A',fontWeight:700,flex:1}}>💶 {missingPrices(clients).length} client{missingPrices(clients).length===1?'e':'i'} senza prezzo: senza non posso calcolare gli incassi.</span>
            <Link to="/economia?tab=prezzi" style={{...s.btnSm,textDecoration:'none'}}>Completa i prezzi</Link>
          </div>
        )}
        {!eco.ready && !loading && (
          <div data-testid="avviso-sql-economia" style={{background:'rgba(232,160,32,0.1)',border:'0.5px solid rgba(232,160,32,0.4)',borderRadius:12,padding:'10px 12px',marginBottom:14,fontSize:11,color:'#E8C050',lineHeight:1.5}}>
            Prezzi e incassi non sono ancora attivi: esegui lo script <b>fofit-economia.sql</b> su Supabase (SQL Editor → incolla → Run), poi ricarica la pagina.
          </div>
        )}

        <EconomyPanel clients={clients} rates={Object.values(allRates).flat()} today={today} onOpen={async id=>{ const c=clients.find(x=>x.id===id); if(!c) return; await openEdit(c); try { document.querySelector(`[data-cliente="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}) } catch {} }}/>

        {/* STATS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          {[
            {l:'Attivi',v:attivi.length,c:'#6FCF97'},
            {l:'In scadenza',v:inScadenza.length,c:'#E8A020'},
            {l:'Scaduti',v:scaduti.length,c:'#E24B4A'},
          ].map(st=>(
            <div key={st.l} style={{background:'#0D0D0D',borderRadius:10,border:'0.5px solid #1C1C1C',padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:st.c}}>{st.v}</div>
              <div style={{fontSize:10,color:'#CCC',textTransform:'uppercase'}}>{st.l}</div>
            </div>
          ))}
        </div>

        {/* LISTA CLIENTI */}
        {loading ? <div style={{textAlign:'center',padding:40,color:'#CCC'}}>Caricamento...</div> :
          clients.map(c => {
            const days = daysLeft(c.subscription_end)
            const isEditing = editing===c.id
            const isBlocked = days!==null && days<0
            const myRates = allRates[c.id] || []
            const rb = c.payment_type==='rate' ? coachBadge(myRates, today) : null
            const paidInst = myRates.filter(r=>r.paid_at).length
            const totalInst = myRates.length || c.installments || 1
            const rateBlocked = rb?.level==='blocked'

            return (
              <div key={c.id} data-cliente={c.id} style={{...s.card, borderColor: isBlocked||rateBlocked?'#E24B4A': rb?'#E8A020':'#2A2A2A'}}>
                {/* HEADER */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:isEditing?12:0}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:isBlocked?'rgba(226,75,74,0.16)':'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:isBlocked?'#E24B4A':'white',flexShrink:0}}>
                    {initials(c.full_name)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#F0F0F0',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      {c.full_name}
                      {isBlocked && <span style={{fontSize:10,background:'rgba(226,75,74,0.12)',color:'#E24B4A',padding:'2px 6px',borderRadius:6,fontWeight:700}}>🔒 BLOCCATO</span>}
                      {rb && <span data-testid="badge-rata" style={{fontSize:10,background:rb.level==='soon'?'rgba(232,160,32,0.1)':'rgba(226,75,74,0.12)',color:rb.level==='soon'?'#E8A020':'#E24B4A',padding:'2px 6px',borderRadius:6,fontWeight:700}}>{rb.text}</span>}
                      {c.payment_type==='rate' && !myRates.length && <span style={{fontSize:10,background:'rgba(232,160,32,0.1)',color:'#E8A020',padding:'2px 6px',borderRadius:6,fontWeight:700}}>NESSUNA SCADENZA RATE</span>}
                    </div>
                    <div style={{fontSize:11,color:'#CCC',marginTop:2}}>
                      {c.subscription_type||'—'}
                      {c.payment_type==='rate' && ` · Rate ${paidInst}/${totalInst}`}
                      {num(c.price_agreed)>0 && ` · ${money(c.price_agreed)}`}
                      {c.subscription_end && ` · Scade ${new Date(c.subscription_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})}`}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                    <StatusBadge days={days}/>
                    {c.subscription_end && days<=30 && days>=0 && (
                      <button onClick={()=>renew(c)} style={s.btnSm}>↻</button>
                    )}
                    <button onClick={()=>isEditing?setEditing(null):openEdit(c)} style={s.btnGray}>
                      {isEditing?'✕':'✏️'}
                    </button>
                  </div>
                </div>

                {/* FORM MODIFICA */}
                {isEditing && (
                  <div style={{borderTop:'0.5px solid #1C1C1C',paddingTop:14}}>

                    {/* TIPO ABBONAMENTO + DATE */}
                    <div style={s.grid2}>
                      <div><label style={s.label}>Tipo abbonamento</label>
                        <select style={s.select} value={form.subscription_type} onChange={e=>setForm(p=>({...p,subscription_type:e.target.value}))}>
                          {TIPI.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={s.label}>Tipo pagamento</label>
                        <select style={s.select} value={form.payment_type} onChange={e=>setForm(p=>({...p,payment_type:e.target.value}))}>
                          <option value="unica">Soluzione unica</option>
                          <option value="rate">Pagamento a rate</option>
                        </select>
                      </div>
                      <div><label style={s.label}>Data inizio</label>
                        <input style={s.input} type="date" value={form.subscription_start} onChange={e=>setForm(p=>({...p,subscription_start:e.target.value}))}/>
                      </div>
                      <div><label style={s.label}>Data scadenza</label>
                        <input style={s.input} type="date" value={form.subscription_end} onChange={e=>setForm(p=>({...p,subscription_end:e.target.value}))}/>
                      </div>
                    </div>

                    {/* PREZZO E INCASSI */}
                    {eco.ready && (() => {
                      const cl = clients.find(x=>x.id===c.id) || c
                      const mine = eco.payments.filter(p=>p.client_id===c.id)
                      const price = num(form.price_agreed)
                      const paid = paidForSubscription({ ...cl, subscription_start: form.subscription_start }, eco.payments)
                      const left = Math.max(0, Math.round((price-paid)*100)/100)
                      return (
                        <div data-testid="sezione-prezzo" style={{background:'rgba(59,140,90,0.08)',border:'0.5px solid rgba(59,140,90,0.35)',borderRadius:10,padding:'14px',marginTop:12}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#6FCF97',marginBottom:8}}>💶 Prezzo e incassi</div>
                          <div style={s.grid2}>
                            <div><label style={s.label}>Prezzo concordato (€)</label>
                              <input aria-label="Prezzo concordato" inputMode="decimal" style={s.input} placeholder="es. 270" value={form.price_agreed} onChange={e=>setForm(p=>({...p,price_agreed:e.target.value}))}/></div>
                            <div><label style={s.label}>Dal listino</label>
                              <select aria-label="Prezzo dal listino" style={s.select} value="" onChange={e=>{ const it=eco.priceList.find(x=>x.id===e.target.value); if(it) setForm(p=>({...p,price_agreed:it.amount})) }}>
                                <option value="">{eco.priceList.length?'Scegli…':'Listino vuoto'}</option>
                                {eco.priceList.map(it=><option key={it.id} value={it.id}>{it.name} — {money(it.amount)}</option>)}
                              </select></div>
                          </div>
                          <div style={{marginTop:8}}><label style={s.label}>Nota sul prezzo</label>
                            <input aria-label="Nota sul prezzo" style={s.input} placeholder="es. sconto amico, omaggio, prezzo bloccato…" value={form.price_note} onChange={e=>setForm(p=>({...p,price_note:e.target.value}))}/></div>
                          {price>0 && form.payment_type!=='rate' && (
                            <div data-testid="saldo-cliente" style={{marginTop:10,fontSize:12,color:'#F0F0F0',display:'flex',gap:12,flexWrap:'wrap'}}>
                              <span>Prezzo {money(price)}</span><span style={{color:'#6FCF97'}}>Incassato {money(paid)}</span>
                              <span style={{color:left>0?'#E8A020':'#6FCF97',fontWeight:700}}>{left>0?`Da incassare ${money(left)}`:'✓ Saldato'}</span>
                            </div>
                          )}
                          <div style={{marginTop:10,fontSize:11,color:'#CCC',fontWeight:600}}>Incassi di questo cliente ({mine.length})</div>
                          {mine.slice(0,8).map(p=>(
                            <div key={p.id} data-testid="incasso-cliente" style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderTop:'0.5px solid #151515',fontSize:12}}>
                              <span style={{color:'#AAA',minWidth:84}}>{fmtDate(p.paid_on)}</span>
                              <span style={{flex:1,color:'#CCC'}}>{kindLabel(p.kind)}{p.method?` · ${p.method}`:''}{p.note?` · ${p.note}`:''}</span>
                              <span style={{fontWeight:700,color:'#6FCF97'}}>{money(p.amount)}</span>
                              {p.installment_id==null ? <button type="button" aria-label="Elimina incasso" onClick={()=>removeIncasso(p)} style={{...s.btnGray,color:'#E24B4A'}}>✕</button> : <span title="Per toglierlo segna la rata «non pagata»" style={{fontSize:10,color:'#777',width:30,textAlign:'center'}}>rata</span>}
                            </div>
                          ))}
                          {mine.length>8 && <div style={{fontSize:10,color:'#888',marginTop:4}}>…e altri {mine.length-8}: li trovi tutti nel registro di Economia.</div>}
                          {!incassoOpen
                            ? <button type="button" onClick={()=>setIncassoOpen(true)} style={{...s.btnGreen,marginTop:8}}>+ Registra incasso</button>
                            : <IncassoForm fixedClient={cl} defaultAmount={left>0&&form.payment_type!=='rate'?left:''} defaultKind={form.payment_type==='rate'?'rata':'abbonamento'} onSave={addIncasso} onCancel={()=>setIncassoOpen(false)}/>}
                          <div style={{fontSize:10,color:'#888',marginTop:8}}>Gli incassi si registrano subito (non serve «Salva»). Le rate segnate «pagata» entrano nel registro quando salvi.</div>
                        </div>
                      )
                    })()}

                    {/* SEZIONE RATE */}
                    {form.payment_type==='rate' && (
                      <div data-testid="sezione-rate" style={{background:'rgba(232,160,32,0.1)',borderRadius:10,padding:'14px',marginTop:12}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#E8A020',marginBottom:4}}>💳 Pagamento a rate</div>
                        <div style={{fontSize:11,color:'#CCC',marginBottom:10,lineHeight:1.5}}>
                          Avviso al cliente da 2 giorni prima. Se una rata non è pagata, l'app si blocca dal {GRACE_DAYS+1}° giorno dopo la scadenza ({GRACE_DAYS} giorni di tolleranza). Le rate future non bloccano.
                        </div>

                        <div style={s.grid2}>
                          <div><label style={s.label}>Numero rate</label>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <button type="button" aria-label="Meno rate" onClick={()=>setCount(installments.length-1)} style={{...s.btnGray,width:40,height:40,fontSize:18}}>−</button>
                              <select aria-label="Numero rate" style={{...s.select,textAlign:'center',fontWeight:700}} value={installments.length||''} onChange={e=>setCount(parseInt(e.target.value))}>
                                {!installments.length && <option value="">—</option>}
                                {Array.from({length:MAX_RATE},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
                              </select>
                              <button type="button" aria-label="Più rate" onClick={()=>setCount(installments.length+1)} style={{...s.btnGray,width:40,height:40,fontSize:18}}>+</button>
                            </div>
                          </div>
                          <div><label style={s.label}>Importo per rata (€)</label>
                            <input aria-label="Importo per rata" inputMode="decimal" style={s.input} placeholder="es. 100" value={form.installment_amount} onChange={e=>setForm(p=>({...p,installment_amount:e.target.value}))}/>
                          </div>
                          <div><label style={s.label}>Scadenza prima rata</label>
                            <input aria-label="Scadenza prima rata" style={s.input} type="date" value={firstDate} onChange={e=>setFirstDate(e.target.value)}/>
                          </div>
                          <div style={{display:'flex',alignItems:'flex-end'}}>
                            <button type="button" onClick={installments.length?regenerate:()=>{ if(!firstDate||!(num(form.installment_amount)>0)){notify('Inserisci la scadenza della prima rata e l\'importo','error');return} setInstallments(generateRates({count:form.installments,amount:form.installment_amount,firstDate}).map(withKey)) }} style={{...s.btnSm,height:40,width:'100%'}}>
                              📅 {installments.length?'Rigenera scadenze mensili':'Genera scadenze mensili'}
                            </button>
                          </div>
                        </div>
                        <div style={{fontSize:10,color:'#AAA',margin:'6px 0 12px'}}>Poi puoi cambiare a mano data e importo di ogni singola rata.</div>

                        {installments.length===0 && <div style={{fontSize:12,color:'#E8A020'}}>Nessuna rata: inserisci numero, importo e prima scadenza, poi «Genera».</div>}

                        {/* RATE */}
                        {installments.map((inst,idx)=>{
                          const st = rateState(inst, today), late = st.code==='overdue'||st.code==='blocked'||st.code==='due_today'
                          const color = inst.paid_at?'#6FCF97': st.code==='blocked'||st.code==='overdue'?'#E24B4A': st.code==='due_today'||st.code==='due_soon'?'#E8A020':'#CCC'
                          const label = inst.paid_at?'Pagata': st.code==='blocked'?`BLOCCANTE · scaduta da ${st.late} gg`: st.code==='overdue'?`Scaduta da ${st.late} gg · blocco tra ${st.daysToBlock}`: st.code==='due_today'?'Scade oggi': st.code==='due_soon'?`Scade tra ${st.left} gg`: 'Da pagare'
                          return (
                            <div key={inst._k} data-testid={`rata-${idx+1}`} style={{border:`0.5px solid ${late&&!inst.paid_at?'rgba(226,75,74,0.5)':'#1C1C1C'}`,borderRadius:9,padding:'10px',marginBottom:8,background:inst.paid_at?'rgba(59,140,90,0.12)':'#0D0D0D'}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                                <span style={{fontSize:12,fontWeight:800,color:'#E8A020',width:28}}>R{idx+1}</span>
                                <span style={{fontSize:11,fontWeight:700,color,flex:1}}>{label}</span>
                                <button type="button" aria-label={`Elimina la rata ${idx+1}`} onClick={()=>removeRate(inst._k)} style={{...s.btnGray,width:34,height:34,color:'#E24B4A'}}>✕</button>
                              </div>
                              <div style={s.grid2}>
                                <div><label style={{...s.label,marginBottom:3}}>Scadenza</label>
                                  <input aria-label={`Scadenza rata ${idx+1}`} style={s.input} type="date" value={inst.due_date?String(inst.due_date).slice(0,10):''} onChange={e=>patchRate(inst._k,{due_date:e.target.value})}/></div>
                                <div><label style={{...s.label,marginBottom:3}}>Importo (€)</label>
                                  <input aria-label={`Importo rata ${idx+1}`} inputMode="decimal" style={s.input} value={inst.amount??''} onChange={e=>patchRate(inst._k,{amount:e.target.value})}/></div>
                              </div>
                              {inst.extended_until && (
                                <div style={{marginTop:8,fontSize:11,color:'#E8C050',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                  <span>⏳ Prorogata fino al {fmtDate(inst.extended_until)}</span>
                                  <button type="button" onClick={()=>patchRate(inst._k,{extended_until:null})} style={s.btnGray}>Togli proroga</button>
                                </div>
                              )}
                              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                                {inst.paid_at
                                  ? <button type="button" onClick={()=>unmarkPaid(inst._k)} style={s.btnGray}>↩ Segna non pagata</button>
                                  : <button type="button" onClick={()=>markPaid(inst._k)} style={s.btnGreen}>✓ Segna pagata</button>}
                                {!inst.paid_at && <button type="button" aria-label={`Proroga rata ${idx+1}`} onClick={()=>setProrogaOpen(prorogaOpen===inst._k?null:inst._k)} style={s.btnSm}>⏳ Proroga</button>}
                              </div>
                              {prorogaOpen===inst._k && !inst.paid_at && (
                                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
                                  {[3,7,14].map(n=><button key={n} type="button" onClick={()=>{prorogate(inst,n);setProrogaOpen(null)}} style={s.btnGray}>+{n} giorni da oggi</button>)}
                                  <input aria-label={`Proroga fino al, rata ${idx+1}`} type="date" style={{...s.input,width:'auto'}} value={inst.extended_until?String(inst.extended_until).slice(0,10):''} onChange={e=>patchRate(inst._k,{extended_until:e.target.value||null})}/>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {installments.length>0 && (
                          <div style={{padding:'8px 10px',fontSize:12,fontWeight:600,color:'#F0F0F0',background:'#161616',borderRadius:8,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                            <span>Totale: {money(ratesTotal(installments))}</span>
                            <span style={{color:'#6FCF97'}}>Pagato: {money(ratesPaid(installments))}</span>
                            <span style={{color:'#E8A020'}}>Da incassare: {money(ratesTotal(installments)-ratesPaid(installments))}</span>
                          </div>
                        )}
                        {eco.ready && num(form.price_agreed)>0 && installments.length>0 && Math.abs(ratesTotal(installments)-num(form.price_agreed))>0.009 && (
                          <div data-testid="avviso-rate-prezzo" style={{fontSize:11,color:'#E8A020',marginTop:6}}>⚠ Le rate sommano {money(ratesTotal(installments))} ma il prezzo concordato è {money(form.price_agreed)}: controlla importi o prezzo (puoi salvare comunque, ad esempio per uno sconto).</div>
                        )}
                      </div>
                    )}

                    <div style={{marginTop:10}}><label style={s.label}>Note</label>
                      <input style={s.input} value={form.subscription_notes} onChange={e=>setForm(p=>({...p,subscription_notes:e.target.value}))} placeholder="es. pagamento mensile, bonifico..."/>
                    </div>

                    <div style={{marginTop:12,display:'flex',gap:8}}>
                      <button onClick={save} disabled={saving||!editReady} style={{...s.btn,opacity:editReady?1:0.5}}>{saving?'Salvo...':'💾 Salva'}</button>
                      <button onClick={()=>setEditing(null)} style={s.btnGray}>Annulla</button>
                    </div>
                  </div>
                )}

                {c.subscription_notes && !isEditing && (
                  <div style={{fontSize:11,color:'#CCC',marginTop:8,fontStyle:'italic'}}>{c.subscription_notes}</div>
                )}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
