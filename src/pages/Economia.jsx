import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { dbSave } from '../lib/db'
import { fetchAllRows } from '../lib/pagedQuery'
import { localDateStr } from '../lib/dates'
import { buildEconomy } from '../lib/economy'
import { num, money, fmtDate, fmtShort } from '../lib/installments'
import { monthTotals, monthSeries, seriesStats, mrr, clientStats, oneOffDue, forecast, missingPrices, shiftMonth, ymOf, monthName, kindLabel, r2, isActive, MISSING_ECONOMY_MSG, isMissingEconomy } from '../lib/ledger'
import IncassoForm from '../components/IncassoForm'
import RegistroIncassi from '../components/economia/RegistroIncassi'
import ListinoPrezzi from '../components/economia/ListinoPrezzi'
import CompletaPrezzi from '../components/economia/CompletaPrezzi'
import { s, Tile, Grid, Empty, Bars } from '../components/economia/ui'

const TABS = [['mese', 'Mese'], ['andamento', 'Andamento'], ['clienti', 'Clienti'], ['incassare', 'Da incassare'], ['registro', 'Registro'], ['listino', 'Listino'], ['prezzi', 'Prezzi']]
const COLS = 'id,full_name,subscription_start,subscription_end,subscription_type,payment_type,price_agreed,price_note'

export default function Economia() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t[0] === params.get('tab')) ? params.get('tab') : 'mese'
  const setTab = t => setParams({ tab: t }, { replace: true })
  const [state, setState] = useState({ loading: true, error: null, clients: [], rates: [], payments: [], priceList: [], goal: null })
  const today = localDateStr()

  const load = useCallback(async () => {
    const pay = await fetchAllRows(() => supabase.from('payments').select('*').order('paid_on', { ascending: false }).order('id'), { maxRows: 20000 })
    if (pay.error) { setState(p => ({ ...p, loading: false, error: isMissingEconomy(pay.error) ? 'sql' : 'rete' })); return }
    const [cl, rr, pl, st] = await Promise.all([
      supabase.from('profiles').select(COLS).eq('role', 'client').order('full_name'),
      fetchAllRows(() => supabase.from('subscription_installments').select('*').order('due_date').order('id'), { maxRows: 10000 }),
      supabase.from('price_list').select('*').order('sort').order('name'),
      supabase.from('economy_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    if (cl.error || rr.error || pl.error) { setState(p => ({ ...p, loading: false, error: isMissingEconomy(cl.error || pl.error) ? 'sql' : 'rete' })); return }
    setState({ loading: false, error: null, clients: cl.data || [], rates: rr.data || [], payments: pay.data || [], priceList: pl.data || [], goal: st?.data?.monthly_goal != null ? num(st.data.monthly_goal) : null })
  }, [])
  useEffect(() => { load() }, [load])
  const { clients, rates, payments, priceList, goal } = state

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ background: '#0D0D0D', borderBottom: '0.5px solid #1A1A1A', padding: '0 22px', height: 56, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div><div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0' }}>Economia</div><div style={{ fontSize: 11, color: '#CCC' }}>Incassi, andamento e da incassare · importi lordi</div></div>
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px 0', flexShrink: 0 }} role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...s.btnGray, padding: '7px 13px', fontSize: 12, whiteSpace: 'nowrap', ...(tab === id ? { background: 'rgba(212,87,10,0.15)', color: '#F4894A', borderColor: '#D4570A', fontWeight: 700 } : {}) }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
        {state.loading ? <div style={{ textAlign: 'center', padding: 40, color: '#CCC' }}>Caricamento…</div>
          : state.error === 'sql' ? <div data-testid="avviso-sql-economia" style={{ ...s.card, borderColor: 'rgba(232,160,32,0.5)', color: '#E8C050', fontSize: 13, lineHeight: 1.6 }}>{MISSING_ECONOMY_MSG}<div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>Su Supabase: SQL Editor → New query → incolla il contenuto del file → Run. Si fa una volta sola.</div></div>
          : state.error ? <div style={{ ...s.card, color: '#F07070', fontSize: 13 }}>Non riesco a leggere i dati: controlla la connessione e <button onClick={() => { setState(p => ({ ...p, loading: true, error: null })); load() }} style={s.btnSm}>riprova</button></div>
          : <>
            {tab === 'mese' && <Mese {...{ clients, rates, payments, today, goal, onChange: load, goTab: setTab }} />}
            {tab === 'andamento' && <Andamento {...{ clients, rates, payments, today }} />}
            {tab === 'clienti' && <Clienti {...{ clients, payments, today, goTab: setTab }} />}
            {tab === 'incassare' && <DaIncassare {...{ clients, rates, payments, today, onChange: load }} />}
            {tab === 'registro' && <RegistroIncassi payments={payments} clients={clients} today={today} onChange={load} />}
            {tab === 'listino' && <ListinoPrezzi items={priceList} onChange={load} />}
            {tab === 'prezzi' && <CompletaPrezzi clients={clients} rates={rates} priceList={priceList.filter(i => i.active !== false)} onChange={load} />}
          </>}
      </div>
    </div>
  )
}

// ── Mese ──
function Mese({ clients, rates, payments, today, goal, onChange, goTab }) {
  const cur = ymOf(today)
  const [ym, setYm] = useState(cur)
  const m = useMemo(() => monthTotals(payments, ym), [payments, ym])
  const prev = useMemo(() => monthTotals(payments, shiftMonth(ym, -1)), [payments, ym])
  const eco = useMemo(() => buildEconomy({ clients, rates, today }), [clients, rates, today])
  const unique = useMemo(() => oneOffDue(clients, payments, today), [clients, payments, today])
  const rec = useMemo(() => mrr(clients, today), [clients, today])
  const [goalIn, setGoalIn] = useState(goal ?? '')
  const isCur = ym === cur
  const diff = r2(m.total - prev.total)
  const uniqueTot = r2(unique.reduce((a, x) => a + x.amount, 0))
  const expected = r2(m.total + eco.expectedMonth - eco.collectedMonth + uniqueTot)
  const pct = goal > 0 ? Math.min(100, Math.round(m.total / goal * 100)) : 0
  async function saveGoal() {
    const v = num(goalIn)
    const r = await dbSave(supabase.from('economy_settings').upsert({ id: 1, monthly_goal: v > 0 ? v : null }, { onConflict: 'id' }), 'l\'obiettivo', 'salvare', { done: v > 0 ? 'Obiettivo salvato' : 'Obiettivo tolto' }); if (r.ok) onChange()
  }
  const kinds = Object.entries(m.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: kindLabel(k), value: v }))
  const methods = Object.entries(m.byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k === '—' ? 'Non indicato' : k, value: v }))
  return (
    <div data-testid="tab-mese">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button aria-label="Mese precedente" onClick={() => setYm(shiftMonth(ym, -1))} style={s.btnGray}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, color: '#F0F0F0', textTransform: 'capitalize' }}>{monthName(ym)}</div>
        <button aria-label="Mese successivo" disabled={isCur} onClick={() => setYm(shiftMonth(ym, 1))} style={{ ...s.btnGray, opacity: isCur ? 0.4 : 1 }}>›</button>
      </div>
      <Grid>
        <Tile testid="mese-incassato" label="Incassato" value={money(m.total)} color="#6FCF97" sub={`${m.count} ${m.count === 1 ? 'incasso' : 'incassi'}${m.clients ? ` · ${m.clients} client${m.clients === 1 ? 'e' : 'i'}` : ''}`} />
        <Tile testid="mese-confronto" label="Mese precedente" value={money(prev.total)} sub={prev.total || m.total ? (diff === 0 ? 'stesso importo' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`) : '—'} color={diff < 0 ? '#F07070' : '#F0F0F0'} />
        {isCur && <Tile testid="mese-previsto" label="Previsto a fine mese" value={money(expected)} sub="incassato + chi deve pagare" color="#E8C050" />}
        <Tile testid="mese-mrr" label="Ricavo mensile ricorrente" value={money(rec.mrr)} sub={`${rec.priced} abbonamenti attivi con prezzo`} />
      </Grid>
      {isCur && (
        <div style={s.card}>
          <div style={s.h}>🎯 Obiettivo del mese</div>
          {goal > 0 && <div data-testid="obiettivo" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#F0F0F0', marginBottom: 4 }}><span>{money(m.total)} di {money(goal)}</span><b style={{ color: pct >= 100 ? '#6FCF97' : '#F4894A' }}>{Math.round(m.total / goal * 100)}%</b></div>
            <div style={{ height: 8, background: '#161616', borderRadius: 4 }}><div style={{ width: `${pct}%`, height: 8, background: pct >= 100 ? '#6FCF97' : '#D4570A', borderRadius: 4 }} /></div>
            {m.total < goal && <div style={{ ...s.muted, marginTop: 4 }}>Mancano {money(goal - m.total)}</div>}
          </div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="Obiettivo mensile" inputMode="decimal" style={s.input} placeholder="Obiettivo mensile in € (vuoto = nessuno)" value={goalIn} onChange={e => setGoalIn(e.target.value)} />
            <button onClick={saveGoal} style={s.btn}>Salva</button>
          </div>
        </div>
      )}
      <div style={s.card}>
        <div style={s.h}>Da cosa arrivano gli incassi</div>
        {m.count === 0 ? <Empty>Nessun incasso in questo mese. Li registri da Abbonamenti (rate «pagata», «Registra incasso») o dal Registro.</Empty> : <>
          <div style={{ ...s.muted, marginBottom: 6 }}>Per tipo</div><Bars items={kinds} fmt={money} />
          <div style={{ ...s.muted, margin: '12px 0 6px' }}>Per metodo di pagamento</div><Bars items={methods} color="#6FCF97" fmt={money} />
        </>}
      </div>
      {missingPrices(clients).length > 0 && <div style={{ ...s.card, borderColor: '#D4570A' }}><span style={{ fontSize: 12, color: '#F4894A' }}>{missingPrices(clients).length} client{missingPrices(clients).length === 1 ? 'e' : 'i'} senza prezzo: ricavo ricorrente e «da incassare» sono incompleti. </span><button onClick={() => goTab('prezzi')} style={s.btnSm}>Completa i prezzi</button></div>}
    </div>
  )
}

// ── Andamento ──
function Andamento({ clients, rates, payments, today }) {
  const series = useMemo(() => monthSeries(payments, today), [payments, today])
  const st = useMemo(() => seriesStats(series, payments, today), [series, payments, today])
  const fc = useMemo(() => forecast({ clients, rates, today }), [clients, rates, today])
  const rec = mrr(clients, today)
  const cur = ymOf(today)
  const ytdDiff = r2(st.ytd - st.prevYtd)
  return (
    <div data-testid="tab-andamento">
      <Grid>
        <Tile testid="and-media" label="Media mensile" value={money(st.avg)} sub={st.months ? `su ${st.months} ${st.months === 1 ? 'mese' : 'mesi'} con incassi` : '—'} />
        <Tile testid="and-miglior" label="Miglior mese" value={st.best ? money(st.best.total) : '—'} sub={st.best ? monthName(st.best.ym) : ''} color="#6FCF97" />
        <Tile testid="and-anno" label="Da inizio anno" value={money(st.ytd)} sub={st.prevYtd ? `anno scorso, stesso periodo: ${money(st.prevYtd)} (${ytdDiff >= 0 ? '+' : '−'}${money(Math.abs(ytdDiff))})` : 'nessun dato dell\'anno scorso'} />
        <Tile testid="and-mrr" label="Ricavo ricorrente / mese" value={money(rec.mrr)} sub="abbonamenti attivi" color="#E8C050" />
      </Grid>
      <div style={s.card}>
        <div style={s.h}>Incassato negli ultimi 12 mesi</div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#AAA' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 9, fill: '#AAA' }} tickLine={false} axisLine={false} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#161616', border: '0.5px solid #2A2A2A', borderRadius: 8, fontSize: 12 }} formatter={v => [money(v), 'Incassato']} />
              <Bar dataKey="total" radius={[3, 3, 0, 0]} isAnimationActive={false}>{series.map(x => <Cell key={x.ym} fill={x.ym === cur ? '#F4894A' : '#D4570A'} fillOpacity={x.ym === cur ? 1 : 0.7} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div data-testid="serie-mesi" style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 4 }}>
          {series.map(x => <div key={x.ym} style={{ fontSize: 11, color: x.total ? '#F0F0F0' : '#666', display: 'flex', justifyContent: 'space-between', gap: 6 }}><span style={{ color: '#AAA' }}>{x.label}</span><span>{money(x.total)}</span></div>)}
        </div>
      </div>
      <div style={s.card} data-testid="previsione">
        <div style={s.h}>🔮 Prossimi 3 mesi</div>
        <div style={{ ...s.muted, lineHeight: 1.5, marginBottom: 6 }}>Rate ancora da pagare in scadenza in quel mese, più i rinnovi dei clienti a soluzione unica che scadono il mese prima (al loro prezzo, <b>se rinnovano</b>). È una stima, non un incasso certo.</div>
        {fc.map(f => (
          <div key={f.ym} style={s.row}><span style={{ flex: 1, color: '#F0F0F0', textTransform: 'capitalize' }}>{monthName(f.ym)}</span><span style={s.muted}>rate {money(f.rates)} · rinnovi {money(f.renewals)} ({f.renewalCount})</span><b style={{ minWidth: 70, textAlign: 'right' }}>{money(f.total)}</b></div>
        ))}
      </div>
    </div>
  )
}

// ── Clienti ──
function Clienti({ clients, payments, today, goTab }) {
  const cs = useMemo(() => clientStats({ clients, payments, today }), [clients, payments, today])
  const rec = mrr(clients, today)
  const top = useMemo(() => {
    const by = {}; for (const p of payments) { const k = p.client_id || p.client_name || '—'; by[k] = by[k] || { name: p.client_name || 'Senza nome', total: 0 }; by[k].total = r2(by[k].total + num(p.amount)) }
    return Object.values(by).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [payments])
  const missing = missingPrices(clients).length
  return (
    <div data-testid="tab-clienti">
      <Grid>
        <Tile testid="cli-attivi" label="Clienti attivi" value={cs.active} sub={`su ${cs.total} totali`} color="#6FCF97" />
        <Tile testid="cli-medio" label="Ricavo medio / cliente attivo" value={money(cs.avgPerActive)} sub="al mese, dal prezzo concordato" />
        <Tile testid="cli-pagante" label="Incasso medio per pagante" value={money(cs.avgPerPayer)} sub={`${cs.payingMonth} ${cs.payingMonth === 1 ? 'cliente ha pagato' : 'clienti hanno pagato'} questo mese`} />
        <Tile testid="cli-nuovi" label="Nuovi nel mese" value={cs.newMonth} sub="primo incasso ricevuto questo mese" />
        <Tile testid="cli-rinnovo" label="In rinnovo (30 giorni)" value={cs.renewing} color="#E8C050" />
        <Tile testid="cli-persi" label="Scaduti da meno di 30 giorni" value={cs.lost} color={cs.lost ? '#F07070' : '#6FCF97'} sub="non rinnovati" />
      </Grid>
      {missing > 0 && <div style={{ ...s.card, borderColor: '#D4570A' }}><span style={{ fontSize: 12, color: '#F4894A' }}>{missing} client{missing === 1 ? 'e' : 'i'} senza prezzo: le medie escludono {missing === 1 ? 'questo cliente' : 'questi clienti'}. </span><button onClick={() => goTab('prezzi')} style={s.btnSm}>Completa i prezzi</button></div>}
      <div style={s.card}>
        <div style={s.h}>I clienti che hanno incassato di più (da sempre)</div>
        {top.length === 0 ? <Empty>Nessun incasso registrato.</Empty> : top.map((t, i) => <div key={t.name + i} style={s.row}><span style={{ color: '#888', width: 18 }}>{i + 1}.</span><span style={{ flex: 1, color: '#F0F0F0' }}>{t.name}</span><b>{money(t.total)}</b></div>)}
      </div>
    </div>
  )
}

// ── Da incassare ──
function DaIncassare({ clients, rates, payments, today, onChange }) {
  const eco = useMemo(() => buildEconomy({ clients, rates, today }), [clients, rates, today])
  const unique = useMemo(() => oneOffDue(clients, payments, today), [clients, payments, today])
  const byId = Object.fromEntries(clients.map(c => [c.id, c]))
  const [open, setOpen] = useState(null)
  const uniqueTot = r2(unique.reduce((a, x) => a + x.amount, 0))
  async function add(payload) {
    const r = await dbSave(supabase.from('payments').insert(payload), 'l\'incasso', 'salvare', { done: 'Incasso registrato' }); if (!r.ok) return false
    setOpen(null); onChange(); return true
  }
  const total = r2(eco.overdueTotal + uniqueTot)
  const renewals = eco.renewals.map(r => ({ ...r, price: num(byId[r.clientId]?.price_agreed) }))
  return (
    <div data-testid="tab-incassare">
      <Grid>
        <Tile testid="inc-totale" label="Arretrati da incassare" value={money(total)} color={total ? '#E8A020' : '#6FCF97'} sub="rate scadute + soluzioni uniche non saldate" />
        <Tile testid="inc-arrivo" label="Rate in arrivo (30 gg)" value={money(eco.upcomingTotal)} color="#E8C050" sub={`${eco.upcoming.length} ${eco.upcoming.length === 1 ? 'rata' : 'rate'}`} />
      </Grid>
      <div style={s.card} data-testid="inc-rate-scadute">
        <div style={s.h}>Rate scadute ({eco.overdue.length})</div>
        {eco.overdue.length === 0 ? <Empty>Nessuna rata scaduta. 🎉</Empty> : eco.overdue.map(r => (
          <div key={r.id} style={s.row}><b style={{ flex: 1, color: '#F0F0F0' }}>{r.name}</b><span style={{ color: '#F07070', fontSize: 11 }}>scaduta da {r.late} gg{r.blocked ? ' · bloccato' : ''}</span><b>{money(r.amount)}</b><Link to="/abbonamenti" style={{ ...s.btnSm, textDecoration: 'none' }}>Apri</Link></div>
        ))}
      </div>
      <div style={s.card} data-testid="inc-unica">
        <div style={s.h}>Soluzioni uniche non saldate ({unique.length})</div>
        {unique.length === 0 ? <Empty>Nessun saldo aperto.</Empty> : unique.map(x => (
          <div key={x.clientId}>
            <div style={s.row}><b style={{ flex: 1, color: '#F0F0F0' }}>{x.name}</b><span style={s.muted}>{x.paid ? `pagato ${money(x.paid)} di ${money(x.price)}` : `prezzo ${money(x.price)}`}{x.since ? ` · dal ${fmtShort(x.since)}` : ''}</span><b style={{ color: '#E8A020' }}>{money(x.amount)}</b>
              <button onClick={() => setOpen(open === x.clientId ? null : x.clientId)} style={s.btnGreen}>+ Incasso</button></div>
            {open === x.clientId && <IncassoForm fixedClient={byId[x.clientId]} defaultAmount={x.amount} onSave={add} onCancel={() => setOpen(null)} />}
          </div>
        ))}
      </div>
      <div style={s.card} data-testid="inc-rinnovi">
        <div style={s.h}>Rinnovi nei prossimi 30 giorni ({renewals.length})</div>
        {renewals.length === 0 ? <Empty>Nessun abbonamento in scadenza.</Empty> : renewals.map(r => (
          <div key={r.clientId} style={s.row}><b style={{ flex: 1, color: '#F0F0F0' }}>{r.name}</b><span style={s.muted}>scade il {fmtDate(r.end)} ({r.days === 0 ? 'oggi' : `${r.days} gg`})</span><b>{r.price ? money(r.price) : <span style={{ color: '#888', fontWeight: 400 }}>senza prezzo</span>}</b><Link to="/abbonamenti" style={{ ...s.btnSm, textDecoration: 'none' }}>Apri</Link></div>
        ))}
        {renewals.some(r => r.price) && <div style={{ ...s.muted, marginTop: 8 }}>Valore dei rinnovi in arrivo, se tutti rinnovano: <b style={{ color: '#F0F0F0' }}>{money(renewals.reduce((a, r) => a + (byId[r.clientId]?.payment_type === 'rate' ? 0 : r.price), 0))}</b> (i clienti a rate sono esclusi: li pagano a rate).</div>}
      </div>
    </div>
  )
}
