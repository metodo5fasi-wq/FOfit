// ─────────────────────────────────────────────────────────────
// Modelli di pasto del coach. Prima stavano solo nel browser (localStorage): cambiando telefono/computer o svuotando i dati sparivano.
// Ora stanno nella tabella meal_templates di Supabase. Se la tabella non c'è ancora (script SQL non eseguito) si continua
// a usare il browser, senza perdere nulla; appena la tabella esiste, i modelli del browser vengono copiati (una volta, senza doppioni).
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase'

const LS_KEY = 'fofit_meal_templates', LS_MIGRATED = 'fofit_meal_templates_migrated'
const readLocal = () => { try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const writeLocal = list => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch {} }
const isMigrated = () => { try { return localStorage.getItem(LS_MIGRATED) === '1' } catch { return false } }
const setMigrated = () => { try { localStorage.setItem(LS_MIGRATED, '1') } catch {} }

const cleanFoods = foods => (Array.isArray(foods) ? foods : []).map(f => ({
  food_name: f.food_name, quantity_g: f.quantity_g, kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
  _origQty: f._origQty ?? f.quantity_g, _origKcal: f._origKcal ?? f.kcal, _origProt: f._origProt ?? f.protein_g, _origCarbs: f._origCarbs ?? f.carbs_g, _origFat: f._origFat ?? f.fat_g,
}))
const signature = t => `${String(t.name || '').trim().toLowerCase()}|${(t.foods || []).map(f => `${f.food_name}:${f.quantity_g}`).join(',')}`
const fromRow = r => ({ id: r.id, name: r.name, meal_type: r.meal_type, foods: Array.isArray(r.foods) ? r.foods : [] })
export const templateKcal = t => Math.round((t.foods || []).reduce((s, f) => s + (Number(f.kcal) || 0), 0))

// Restituisce { templates, remote }: remote=false → si sta usando il browser (tabella assente o errore di rete)
export async function loadTemplates() {
  let res
  try { res = await supabase.from('meal_templates').select('id,name,meal_type,foods,created_at').order('created_at', { ascending: true }).limit(500) } catch (e) { res = { error: e } }
  if (res.error) return { templates: readLocal(), remote: false }
  let list = (res.data || []).map(fromRow)
  if (!isMigrated()) {
    const local = readLocal(), have = new Set(list.map(signature)), todo = local.filter(t => t && t.name && Array.isArray(t.foods) && !have.has(signature(t)))
    if (!todo.length) setMigrated()
    else {
      const ins = await supabase.from('meal_templates').insert(todo.map(t => ({ name: t.name, meal_type: t.meal_type || null, foods: cleanFoods(t.foods) }))).select('id,name,meal_type,foods')
      if (!ins.error) { setMigrated(); list = [...list, ...(ins.data || []).map(fromRow)] }      // copia riuscita: i modelli del browser restano lì come copia di sicurezza
    }
  }
  return { templates: list, remote: true }
}

// Salva un modello. Restituisce { ok, template, remote, error }
export async function saveTemplate({ name, meal_type, foods }, remote) {
  const t = { name: String(name || '').trim(), meal_type: meal_type || null, foods: cleanFoods(foods) }
  if (!t.name || !t.foods.length) return { ok: false, error: new Error(!t.name ? 'Manca il nome' : 'Il pasto è vuoto') }
  if (remote) {
    const r = await supabase.from('meal_templates').insert(t).select('id,name,meal_type,foods').single()
    if (!r.error) return { ok: true, remote: true, template: fromRow(r.data) }
    return { ok: false, error: r.error }                       // niente salvataggio "di nascosto" nel browser: il coach deve sapere che non è andato
  }
  const local = { ...t, id: Date.now() }
  writeLocal([...readLocal(), local])
  return { ok: true, remote: false, template: local }
}

export async function deleteTemplate(id, remote) {
  if (remote) {
    const r = await supabase.from('meal_templates').delete().eq('id', id).select('id')
    if (r.error) return { ok: false, error: r.error }
    return r.data?.length ? { ok: true } : { ok: false, error: new Error('Il modello non è stato eliminato (permessi)') }
  }
  writeLocal(readLocal().filter(t => t.id !== id)); return { ok: true }
}
