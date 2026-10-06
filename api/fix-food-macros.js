// API per ricalcolare i macro degli alimenti già salvati nei piani
// Usata una tantum per sistemare i dati esistenti
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).end()

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Config mancante' })

  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }

  try {
    // Prendi tutti gli alimenti con kcal = 0 o null
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/plan_meal_foods?or=(kcal.is.null,kcal.eq.0)&select=id,food_name,quantity_g`,
      { headers }
    )
    const foods = await r.json()
    if (!foods?.length) return res.status(200).json({ fixed: 0, message: 'Nessun alimento da sistemare' })

    // Carica tutto il database alimenti
    const rDb = await fetch(
      `${SUPABASE_URL}/rest/v1/food_database?select=name,kcal_100,protein_100,carbs_100,fat_100`,
      { headers }
    )
    const db = await rDb.json()
    const dbMap = {}
    for (const f of (db || [])) {
      dbMap[f.name.toLowerCase().trim()] = f
    }

    let fixed = 0
    for (const food of foods) {
      const key = (food.food_name || '').toLowerCase().trim()
      const match = dbMap[key] || Object.entries(dbMap).find(([k]) => k.includes(key) || key.includes(k))?.[1]
      if (!match) continue

      const qty = parseFloat(food.quantity_g) || 100
      const kcal = Math.round(match.kcal_100 * qty / 100)
      const prot = Math.round(match.protein_100 * qty / 100 * 10) / 10
      const carbs = Math.round(match.carbs_100 * qty / 100 * 10) / 10
      const fat = Math.round(match.fat_100 * qty / 100 * 10) / 10

      await fetch(
        `${SUPABASE_URL}/rest/v1/plan_meal_foods?id=eq.${food.id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ kcal, protein_g: prot, carbs_g: carbs, fat_g: fat }) }
      )
      fixed++
    }

    return res.status(200).json({ fixed, total: foods.length })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
