import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dbSave } from '../lib/db'
import { notify } from '../lib/toast'
import { FOOD_DB } from '../data/foodDatabase.js'
import { checkFood, fromRow, toRow, CAT_OTHER } from '../lib/customFoods'
import { refreshCustomFoods } from '../lib/useCustomFoods'

const label = { fontSize: 11, color: '#CCC', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }
const input = { width: '100%', padding: '9px 12px', border: '0.5px solid #1C1C1C', borderRadius: 8, fontSize: 13, color: '#F0F0F0', background: '#161616', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const btn = { background: '#D4570A', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGray = { background: '#161616', color: '#CCC', border: '0.5px solid #1C1C1C', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
let CATS = null
const categories = () => CATS || (CATS = [...new Set(FOOD_DB.map(f => f.cat))].sort((a, b) => a.localeCompare(b, 'it')))

// Inserisce (o modifica) un alimento del coach. Si salva da sé; onSaved(alimento) a salvataggio riuscito.
//   initial: alimento da modificare (con id)   defaultName: nome già scritto nella ricerca
export default function NuovoAlimentoForm({ initial, defaultName = '', onSaved, onCancel }) {
  const [f, setF] = useState(() => ({ name: initial?.name || defaultName, brand: initial?.brand && initial.brand !== '—' ? initial.brand : '', cat: initial?.cat || CAT_OTHER, kcal100: initial ? String(initial.kcal100) : '', p: initial ? String(initial.p) : '', c: initial ? String(initial.c) : '', g: initial ? String(initial.g) : '' }))
  const [busy, setBusy] = useState(false)
  const [confirmWarn, setConfirmWarn] = useState(false)
  const cats = useMemo(() => { const c = categories(); return f.cat && !c.includes(f.cat) ? [...c, f.cat] : c }, [f.cat])
  const chk = useMemo(() => checkFood(f), [f])
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setConfirmWarn(false) }
  const [showErr, setShowErr] = useState(false)

  async function submit(e) {
    e?.preventDefault?.()
    if (busy) return
    if (!chk.ok) { setShowErr(true); notify(chk.errors[0], 'error'); return }
    if (chk.warnings.length && !confirmWarn) { setConfirmWarn(true); return }
    setBusy(true)
    try {
      const row = toRow(chk.food)
      const r = await dbSave(initial?.id ? supabase.from('custom_foods').update(row).eq('id', initial.id).select() : supabase.from('custom_foods').insert(row).select(), 'l\'alimento', 'salvare', { silent: true })
      if (!r.ok) {
        const m = String(r.error?.message || '')
        if (r.error?.code === '23505' || /duplicate|unique/i.test(m)) notify('Esiste già un alimento con questo nome e questa marca.', 'error')
        else if (/custom_foods|relation|schema/i.test(m)) notify('Per salvare i tuoi alimenti serve eseguire lo script fofit-alimenti-miei.sql su Supabase (una volta sola).', 'error')
        else notify('Non sono riuscito a salvare l\'alimento. Riprova.', 'error')
        return
      }
      await refreshCustomFoods()
      notify(initial?.id ? 'Alimento aggiornato' : 'Alimento aggiunto ai tuoi alimenti', 'success')
      const saved = r.data?.[0] ? fromRow(r.data[0]) : { ...fromRow({ ...row, id: initial?.id }) }
      onSaved?.(saved)
    } finally { setBusy(false) }
  }
  const num = (k, lab, ph) => <div><label style={label} htmlFor={`na-${k}`}>{lab}</label><input id={`na-${k}`} inputMode="decimal" style={input} placeholder={ph} value={f[k]} onChange={e => set(k, e.target.value)} /></div>
  return (
    <form data-testid="form-nuovo-alimento" onSubmit={submit} style={{ padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={label} htmlFor="na-name">Nome</label><input id="na-name" style={input} placeholder="es. Pane di segale" value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></div>
        <div><label style={label} htmlFor="na-brand">Marca (facoltativa)</label><input id="na-brand" style={input} value={f.brand} onChange={e => set('brand', e.target.value)} /></div>
        <div><label style={label} htmlFor="na-cat">Categoria</label>
          <select id="na-cat" style={input} value={f.cat} onChange={e => set('cat', e.target.value)}>{[CAT_OTHER, ...cats.filter(c => c !== CAT_OTHER)].map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ fontSize: 11, color: '#AAA', margin: '12px 0 6px' }}>Valori per 100 g di alimento</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(80px,1fr))', gap: 10 }}>
        {num('kcal100', 'Kcal', 'es. 250')}{num('p', 'Proteine g', '0')}{num('c', 'Carboidrati g', '0')}{num('g', 'Grassi g', '0')}
      </div>
      {chk.food && chk.macroKcal > 0 && (
        <div data-testid="macro-kcal" style={{ fontSize: 11, color: '#AAA', marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          Dai macro: <b style={{ color: '#F0F0F0' }}>{chk.macroKcal} kcal</b>
          {String(f.kcal100).trim() !== String(chk.macroKcal) && <button type="button" onClick={() => set('kcal100', String(chk.macroKcal))} style={{ ...btnGray, padding: '3px 9px', fontSize: 11 }}>Usa queste kcal</button>}
        </div>
      )}
      {showErr && chk.errors.length > 0 && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: '#F07070', lineHeight: 1.5 }}>{chk.errors.map(m => <div key={m}>• {m}</div>)}</div>}
      {chk.ok && chk.warnings.length > 0 && <div data-testid="avviso-kcal" style={{ marginTop: 8, fontSize: 12, color: '#E8C050', lineHeight: 1.5, background: 'rgba(232,160,32,0.08)', border: '0.5px solid rgba(232,160,32,0.35)', borderRadius: 8, padding: '8px 10px' }}>{chk.warnings[0]}{confirmWarn && <b> Premi ancora «Salva comunque» per confermare.</b>}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'Salvo…' : confirmWarn ? 'Salva comunque' : initial?.id ? 'Salva modifiche' : 'Salva alimento'}</button>
        <button type="button" onClick={onCancel} style={btnGray}>Annulla</button>
      </div>
    </form>
  )
}

// Finestra con il modulo, per aprirlo dalla ricerca alimenti
export function NuovoAlimentoModal({ defaultName, onSaved, onClose }) {
  return (
    <div role="dialog" aria-label="Nuovo alimento" data-testid="modale-nuovo-alimento" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#0D0D0D', border: '0.5px solid #2A2A2A', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}>Nuovo alimento</div>
          <button type="button" aria-label="Chiudi" onClick={onClose} style={{ ...btnGray, padding: '3px 9px' }}>✕</button>
        </div>
        <NuovoAlimentoForm defaultName={defaultName} onSaved={onSaved} onCancel={onClose} />
      </div>
    </div>
  )
}
