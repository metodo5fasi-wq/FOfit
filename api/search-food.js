export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).end()

  const q = (req.query.q || '').trim().toLowerCase()
  const limit = parseInt(req.query.limit) || 10
  if (!q || q.length < 2) return res.status(200).json({ foods: [] })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ foods: [] })
  }

  try {
    // Cerca prima in plan_meal_foods (alimenti già usati nei piani)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/plan_meal_foods?food_name=ilike.*${encodeURIComponent(q)}*&select=food_name,quantity_g,kcal,protein_g,carbs_g,fat_g&limit=${limit * 3}`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    )
    const raw = await r.json()

    // Deduplicata per nome e calcola valori per 100g
    const seen = new Set()
    const foods = []
    for (const f of (raw || [])) {
      const name = f.food_name?.trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      const qty = parseFloat(f.quantity_g) || 100
      foods.push({
        name,
        kcal_100: Math.round((parseFloat(f.kcal) || 0) / qty * 100),
        protein_100: Math.round((parseFloat(f.protein_g) || 0) / qty * 100 * 10) / 10,
        carbs_100: Math.round((parseFloat(f.carbs_g) || 0) / qty * 100 * 10) / 10,
        fat_100: Math.round((parseFloat(f.fat_g) || 0) / qty * 100 * 10) / 10,
      })
      if (foods.length >= limit) break
    }

    return res.status(200).json({ foods })
  } catch(e) {
    return res.status(200).json({ foods: [], error: e.message })
  }
}
