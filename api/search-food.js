import { searchFoods } from '../src/data/foodDatabase.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).end()

  const q = (req.query.q || '').trim()
  const limit = parseInt(req.query.limit) || 10
  if (!q || q.length < 2) return res.status(200).json({ foods: [] })

  try {
    const results = searchFoods(q).slice(0, limit)
    return res.status(200).json({
      foods: results.map(f => ({
        name: f.name,
        brand: f.brand || '',
        category: f.cat || '',
        kcal_100: f.kcal100,
        protein_100: f.p,
        carbs_100: f.c,
        fat_100: f.g,
      }))
    })
  } catch(e) {
    return res.status(200).json({ foods: [], error: e.message })
  }
}
