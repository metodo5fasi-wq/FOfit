import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'18px 22px' },
  card: { background:'white', borderRadius:10, border:'0.5px solid #E0DDD6', padding:'16px', marginBottom:12 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  btnGray: { background:'#F5F3EF', color:'#888780', border:'0.5px solid #E0DDD6', borderRadius:8, padding:'10px 18px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  badge: { fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:500 },
  catHeader: { fontSize:11, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', padding:'10px 0 6px', display:'flex', alignItems:'center', gap:6 },
  item: { display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'0.5px solid #F5F3EF', cursor:'pointer' },
}

// Mappa categoria → icona e colore
const CAT_META = {
  'Carne e pesce': { icon:'ti-meat', color:'#E24B4A' },
  'Latticini e uova': { icon:'ti-cheese', color:'#FAC775' },
  'Frutta': { icon:'ti-apple', color:'#3B6D11' },
  'Verdure': { icon:'ti-leaf', color:'#3B6D11' },
  'Cereali e pasta': { icon:'ti-bowl', color:'#F4894A' },
  'Legumi': { icon:'ti-circle', color:'#D4570A' },
  'Condimenti e grassi': { icon:'ti-droplet', color:'#888780' },
  'Integratori': { icon:'ti-pill', color:'#D4570A' },
  'Bevande': { icon:'ti-glass', color:'#4A90D4' },
  'Snack e dolci': { icon:'ti-cookie', color:'#F4894A' },
  'Altro': { icon:'ti-shopping-cart', color:'#888780' },
}

// Assegna categoria in base al tipo pasto e nome alimento
function getCategory(foodName, mealType) {
  const n = (foodName || '').toLowerCase()
  if (n.match(/pollo|tacchino|manzo|vitello|maiale|salmone|tonno|merluzzo|orata|branzino|pesce|gamberetti|bresaola|prosciutto|salame|wurstel|hamburger/)) return 'Carne e pesce'
  if (n.match(/yogurt|latte|ricotta|fiocchi|mozzarella|parmigiano|grana|pecorino|philadelphia|skyr|uov|albume|tuorlo/)) return 'Latticini e uova'
  if (n.match(/banana|mela|pera|arancia|fragole|mirtilli|kiwi|avocado|frutta|limone|mandarino/)) return 'Frutta'
  if (n.match(/spinaci|broccoli|zucchine|pomodori|insalata|carote|peperoni|verdure|funghi|patate|cipolla|aglio/)) return 'Verdure'
  if (n.match(/pasta|riso|pane|fette|gallette|crackers|avena|fiocchi|farina|gnocchi|couscous|quinoa|bulgur/)) return 'Cereali e pasta'
  if (n.match(/ceci|fagioli|lenticchie|piselli|soia|tofu|legumi/)) return 'Legumi'
  if (n.match(/olio|burro|miele|marmellata|nutella|pesto|salsa|aceto|maionese|senape/)) return 'Condimenti e grassi'
  if (n.match(/whey|proteina|creatina|bcaa|integratore|barretta proteica|massa/)) return 'Integratori'
  if (n.match(/acqua|latte di|coca|pepsi|succo|the|caffè|gatorade|energia/)) return 'Bevande'
  if (n.match(/cioccolato|biscotti|gelato|snack|patatine|dolci/)) return 'Snack e dolci'
  return 'Altro'
}

export default function ListaSpesa() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState(null)

  useEffect(() => { if (profile) { fetchItems(); fetchPlan() } }, [profile])

  async function fetchPlan() {
    const { data } = await supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()
    setPlan(data)
  }

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('shopping_list_items').select('*')
      .eq('client_id', profile.id).order('category').order('food_name')
    setItems(data || [])
    setLoading(false)
  }

  async function generateList() {
    if (!plan) return
    setGenerating(true)

    // Prendi tutti gli alimenti del piano
    const { data: meals } = await supabase
      .from('plan_meals')
      .select('*, plan_meal_foods(*)')
      .eq('plan_id', plan.id)

    if (!meals || meals.length === 0) { setGenerating(false); return }

    // Aggrega gli alimenti sommando le quantità per tutta la settimana
    const foodMap = {}
    meals.forEach(meal => {
      ;(meal.plan_meal_foods || []).forEach(food => {
        const key = `${food.food_name}__${food.brand || ''}`
        if (!foodMap[key]) {
          foodMap[key] = {
            food_name: food.food_name,
            brand: food.brand || null,
            quantity_g: 0,
            category: getCategory(food.food_name, meal.meal_type),
          }
        }
        foodMap[key].quantity_g += food.quantity_g || 0
      })
    })

    // Cancella lista esistente e reinserisci
    await supabase.from('shopping_list_items').delete().eq('client_id', profile.id)

    const newItems = Object.values(foodMap).map(item => ({
      ...item,
      client_id: profile.id,
      plan_id: plan.id,
      is_checked: false,
      quantity_g: Math.round(item.quantity_g),
    }))

    if (newItems.length > 0) {
      await supabase.from('shopping_list_items').insert(newItems)
    }

    fetchItems()
    setGenerating(false)
  }

  async function toggleItem(id, checked) {
    await supabase.from('shopping_list_items').update({ is_checked: !checked }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_checked: !checked } : i))
  }

  async function clearChecked() {
    await supabase.from('shopping_list_items').delete().eq('client_id', profile.id).eq('is_checked', true)
    fetchItems()
  }

  const [newItem, setNewItem] = useState('')

  async function addManualItem() {
    if (!newItem.trim()) return
    const item = {
      client_id: profile.id,
      food_name: newItem.trim(),
      category: getCategory(newItem.trim(), ''),
      is_checked: false,
      quantity_g: null,
    }
    await supabase.from('shopping_list_items').insert(item)
    setNewItem('')
    fetchItems()
  }
    await supabase.from('shopping_list_items').delete().eq('client_id', profile.id)
    setItems([])
  }

  // Raggruppa per categoria
  const byCategory = {}
  items.forEach(item => {
    const cat = item.category || 'Altro'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  })

  const total = items.length
  const checked = items.filter(i => i.is_checked).length
  const pct = total > 0 ? Math.round(checked / total * 100) : 0

  return (
    <>
      <div style={s.topbar}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>Lista della spesa</div>
          <div style={{fontSize:12,color:'#888780'}}>{checked}/{total} prodotti</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {checked > 0 && (
            <button style={s.btnGray} onClick={clearChecked}>
              <i className="ti ti-circle-check" style={{fontSize:14,marginRight:4}}/>Rimuovi spuntati
            </button>
          )}
          <button style={s.btn} onClick={generateList} disabled={generating || !plan}>
            <i className="ti ti-refresh" style={{fontSize:14}}/>
            {generating ? 'Generando...' : 'Genera dal piano'}
          </button>
        </div>
      </div>

      <div style={s.page}>

        {/* Barra progresso */}
        {total > 0 && (
          <div style={{...s.card, marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:500,color:'#111'}}>Completato</span>
              <span style={{fontSize:13,color:'#D4570A',fontWeight:500}}>{pct}%</span>
            </div>
            <div style={{height:8,background:'#F5F3EF',borderRadius:4}}>
              <div style={{height:8,borderRadius:4,background:pct===100?'#3B6D11':'#D4570A',width:`${pct}%`,transition:'width 0.3s'}}/>
            </div>
            <div style={{fontSize:12,color:'#888780',marginTop:6}}>{checked} prodotti nel carrello · {total-checked} rimanenti</div>
          </div>
        )}

        {/* Lista vuota */}
        {!loading && total === 0 && (
          <div style={{...s.card, textAlign:'center', padding:'40px 20px'}}>
            <i className="ti ti-shopping-cart" style={{fontSize:48,color:'#E0DDD6',display:'block',marginBottom:16}}/>
            <div style={{fontSize:15,fontWeight:500,color:'#111',marginBottom:8}}>Lista vuota</div>
            <div style={{fontSize:13,color:'#888780',marginBottom:20,lineHeight:1.6}}>
              {plan ? 'Clicca "Genera dal piano" per creare automaticamente la lista della spesa dal tuo piano alimentare.' : 'Non hai un piano alimentare attivo. Contatta il tuo coach!'}
            </div>
            {plan && (
              <button style={{...s.btn,margin:'0 auto'}} onClick={generateList} disabled={generating}>
                <i className="ti ti-sparkles" style={{fontSize:14}}/>
                {generating ? 'Generando...' : 'Genera lista della spesa'}
              </button>
            )}
          </div>
        )}

        {/* Items raggruppati per categoria */}
        {Object.entries(byCategory).map(([cat, catItems]) => {
          const meta = CAT_META[cat] || CAT_META['Altro']
          const catChecked = catItems.filter(i => i.is_checked).length
          return (
            <div key={cat} style={s.card}>
              <div style={s.catHeader}>
                <i className={`ti ${meta.icon}`} style={{fontSize:13,color:meta.color}}/>
                {cat}
                <span style={{...s.badge, background:'#F5F3EF', color:'#888780', marginLeft:'auto'}}>
                  {catChecked}/{catItems.length}
                </span>
              </div>
              {catItems.map(item => (
                <div key={item.id} style={{...s.item, opacity: item.is_checked ? 0.5 : 1}}
                  onClick={() => toggleItem(item.id, item.is_checked)}>
                  <div style={{
                    width:22, height:22, borderRadius:6, border:`2px solid ${item.is_checked?'#D4570A':'#E0DDD6'}`,
                    background: item.is_checked?'#D4570A':'white', display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0, transition:'all 0.15s'
                  }}>
                    {item.is_checked && <i className="ti ti-check" style={{fontSize:12,color:'white'}}/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'#111',textDecoration:item.is_checked?'line-through':'none',fontWeight:500}}>
                      {item.food_name}
                    </div>
                    {item.brand && item.brand !== '—' && (
                      <div style={{fontSize:11,color:'#888780'}}>{item.brand}</div>
                    )}
                  </div>
                  {item.quantity_g > 0 && (
                    <div style={{fontSize:12,color:'#888780',flexShrink:0}}>
                      {item.quantity_g >= 1000 ? `${(item.quantity_g/1000).toFixed(1)}kg` : `${item.quantity_g}g`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {/* Aggiungi manualmente */}
        <div style={s.card}>
          <div style={{fontSize:13,fontWeight:500,color:'#111',marginBottom:10,display:'flex',alignItems:'center',gap:7}}>
            <i className="ti ti-plus" style={{fontSize:14,color:'#D4570A'}}/>
            Aggiungi prodotto
          </div>
          <div style={{display:'flex',gap:8}}>
            <input
              style={{flex:1,padding:'9px 12px',border:'0.5px solid #E0DDD6',borderRadius:8,fontSize:13,color:'#111',background:'#F5F3EF',outline:'none',fontFamily:'inherit'}}
              placeholder="Es. detersivo, carta igienica, latte..."
              value={newItem}
              onChange={e=>setNewItem(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addManualItem()}
            />
            <button style={s.btn} onClick={addManualItem} disabled={!newItem.trim()}>
              <i className="ti ti-plus" style={{fontSize:14}}/>
            </button>
          </div>
        </div>

        {/* Svuota tutto */}
        {total > 0 && (
          <div style={{textAlign:'center',marginTop:8,marginBottom:20}}>
            <button onClick={clearAll} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#888780',fontFamily:'inherit'}}>
              <i className="ti ti-trash" style={{fontSize:12,marginRight:4}}/>Svuota lista
            </button>
          </div>
        )}

      </div>
    </>
  )
}
