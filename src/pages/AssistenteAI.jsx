import React, { useState, useEffect, useRef } from 'react'
import { localDateStr } from '../lib/dates'
import { dbSave } from '../lib/db'
import { authFetch } from '../lib/authFetch'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useNavigate } from 'react-router-dom'
import { PulseDot } from '../components/Animations'
import { buildContext } from '../lib/assistantContext'
import { readSse } from '../lib/assistantStream'

const SUGGERIMENTI = [
  { label: '🍳 Ricetta con pollo', text: 'Dammi una ricetta sfiziosa con il pollo che rispetti i miei macro per il pranzo.' },
  { label: '🔄 Sostituisci alimento', text: 'Puoi aiutarmi a trovare un\'alternativa sfiziosa a un alimento del mio piano?' },
  { label: '📊 Analizza piano', text: 'Puoi analizzare il mio piano alimentare e dirmi se è bilanciato per il mio obiettivo?' },
  { label: '🥗 Piatto sfizioso', text: 'Suggeriscimi un piatto gustoso e creativo che rispetti i miei macro.' },
  { label: '🍽️ Cosa mi resta oggi?', text: 'Guarda il mio diario di oggi: quante kcal e macro mi restano e cosa posso mangiare per restare nel piano?' },
  { label: '🍝 Sostituzione carboidrati', text: 'Quali sono le migliori alternative ai carboidrati del mio piano, con grammature equivalenti?' },
]

const MEAL_SLOTS = ['colazione','spuntino','pranzo','pre-workout','cena','merenda']
const MEAL_LABELS = { colazione:'Colazione', spuntino:'Spuntino', pranzo:'Pranzo', 'pre-workout':'Pre-workout', cena:'Cena', merenda:'Merenda' }

const s = {
  topbar: { background:'#0D0D0D', borderBottom:'0.5px solid #1A1A1A', padding:'0 22px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px 22px', display:'flex', flexDirection:'column', gap:12 },
  msgUser: { alignSelf:'flex-end', background:'#D4570A', color:'white', borderRadius:'14px 14px 4px 14px', padding:'10px 14px', maxWidth:'80%', fontSize:13, lineHeight:1.5 },
  msgAI: { alignSelf:'flex-start', background:'#0D0D0D', border:'0.5px solid #1C1C1C', borderRadius:'14px 14px 14px 4px', padding:'12px 14px', maxWidth:'88%', fontSize:13, lineHeight:1.7, color:'#F0F0F0' },
  msgLoading: { alignSelf:'flex-start', background:'#0D0D0D', border:'0.5px solid #1C1C1C', borderRadius:'14px 14px 14px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center' },
  bottom: { padding:'12px 22px 20px', background:'#0D0D0D', borderTop:'0.5px solid #1A1A1A', flexShrink:0 },
  input: { flex:1, padding:'10px 14px', border:'0.5px solid #1C1C1C', borderRadius:22, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', resize:'none', maxHeight:100, lineHeight:1.5 },
  sendBtn: { width:40, height:40, borderRadius:'50%', background:'#D4570A', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
}

// Card ricetta con bottone aggiungi al diario
function RecipeCard({ recipe, onAdd }) {
  const [selectedMeal, setSelectedMeal] = useState(recipe.pasto || 'pranzo')
  const [added, setAdded] = useState(false)

  async function handleAdd() {
    await onAdd(recipe, selectedMeal)
    setAdded(true)
  }

  return (
    <div style={{background:'linear-gradient(135deg,rgba(212,87,10,0.14),rgba(212,87,10,0.10))',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:12,padding:'14px',marginTop:8}}>
      {/* Header ricetta */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        <div style={{width:36,height:36,borderRadius:10,background:'#D4570A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <i className="ti ti-chef-hat" style={{fontSize:18,color:'white'}}/>
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:'#F0F0F0'}}>{recipe.titolo}</div>
          <div style={{fontSize:11,color:'#AAA'}}>{recipe.kcal_totali} kcal · P{recipe.p_totali}g C{recipe.c_totali}g G{recipe.g_totali}g</div>
        </div>
      </div>

      {/* Ingredienti */}
      <div style={{marginBottom:12}}>
        {recipe.ingredienti.map((ing, i) => (
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid rgba(212,87,10,0.1)'}}>
            <span style={{fontSize:12,color:'#F0F0F0'}}>{ing.nome}{ing.stima ? <span title="Valori stimati" style={{color:'#E8C050'}}> ≈</span> : null}</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:11,color:'#AAA'}}>{ing.quantita_g}g</span>
              <span style={{fontSize:11,color:'#F4894A',fontWeight:500}}>{ing.kcal} kcal</span>
            </div>
          </div>
        ))}
      </div>

      {Array.isArray(recipe.passaggi) && recipe.passaggi.length > 0 && (
        <ol data-testid="ricetta-passaggi" style={{margin:'0 0 12px',paddingLeft:18,fontSize:12,color:'#DDD',lineHeight:1.5}}>
          {recipe.passaggi.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      )}

      {/* Seleziona pasto + bottone */}
      {!added ? (
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select
            value={selectedMeal}
            onChange={e=>setSelectedMeal(e.target.value)}
            style={{flex:1,padding:'8px 10px',border:'0.5px solid rgba(212,87,10,0.35)',borderRadius:8,fontSize:12,color:'#F0F0F0',background:'#0D0D0D',outline:'none',fontFamily:'inherit'}}>
            {MEAL_SLOTS.map(m => (
              <option key={m} value={m}>{MEAL_LABELS[m]}</option>
            ))}
          </select>
          <button onClick={handleAdd} style={{
            background:'#D4570A',color:'white',border:'none',borderRadius:8,
            padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',
            fontFamily:'inherit',display:'flex',alignItems:'center',gap:5,flexShrink:0
          }}>
            <i className="ti ti-plus" style={{fontSize:13}}/>
            Aggiungi al diario
          </button>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--green-light)',borderRadius:8}}>
          <i className="ti ti-circle-check" style={{fontSize:16,color:'var(--green)'}}/>
          <span style={{fontSize:12,color:'var(--green)',fontWeight:500}}>Aggiunto a {MEAL_LABELS[selectedMeal]}!</span>
        </div>
      )}
    </div>
  )
}

export default function AssistenteAI() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientContext, setClientContext] = useState({})
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const today = localDateStr()

  useEffect(() => { if (profile) { loadContext(); loadHistory() } }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  // Tutto quello che l'assistente deve sapere: piano intero, anamnesi, diario di oggi, peso, allenamenti (ogni lettura che fallisce non blocca le altre)
  const rowsRef = useRef({})
  const safe = p => Promise.resolve(p).then(r => r?.data ?? null, () => null)
  async function loadContext() {
    const [plan, progress, anamnesi, diary, wplan, sessions] = await Promise.all([
      safe(supabase.from('meal_plans').select('*').eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()),
      safe(supabase.from('progress_entries').select('entry_date,weight_kg,waist_cm').eq('client_id', profile.id).order('entry_date', { ascending: false }).limit(8)),
      safe(supabase.from('anamnesi').select('*').eq('client_id', profile.id).maybeSingle()),
      safe(supabase.from('diary_entries').select('meal_type,food_name,quantity_g,kcal,protein_g,carbs_g,fat_g').eq('client_id', profile.id).eq('entry_date', today)),
      safe(supabase.from('workout_plans').select('id,title').eq('client_id', profile.id).eq('is_active', true).limit(1)),
      safe(supabase.from('workout_sessions').select('session_date').eq('client_id', profile.id).order('session_date', { ascending: false }).limit(6)),
    ])
    const [meals, exercises] = await Promise.all([
      plan ? safe(supabase.from('plan_meals').select('*, plan_meal_foods(*)').eq('plan_id', plan.id).order('meal_order')) : null,
      wplan?.[0] ? safe(supabase.from('workout_exercises').select('day_label').eq('plan_id', wplan[0].id)) : null,
    ])
    rowsRef.current = { profile, plan, meals: meals || [], anamnesi, diary: diary || [], progress: progress || [], workoutPlan: wplan?.[0], workoutDays: (exercises || []).map(e => e.day_label), sessions: sessions || [] }
    setClientContext(buildContext(rowsRef.current))
  }
  // il diario cambia durante la giornata: prima di ogni domanda lo rileggo (una sola lettura)
  async function freshContext() {
    const diary = await safe(supabase.from('diary_entries').select('meal_type,food_name,quantity_g,kcal,protein_g,carbs_g,fat_g').eq('client_id', profile.id).eq('entry_date', today))
    if (!diary) return clientContext
    rowsRef.current = { ...rowsRef.current, diary }
    const c = buildContext(rowsRef.current); setClientContext(c); return c
  }

  async function loadHistory() {
    const { data } = await supabase.from('ai_chat_messages').select('*')
      .eq('client_id', profile.id).order('created_at').limit(50)
    if (data && data.length > 0) {
      setMessages(data.map(m => ({ role: m.role, content: m.content, id: m.id, recipe: m.recipe || null })))
    } else {
      setMessages([{
        role: 'assistant',
        content: `Ciao ${profile.full_name?.split(' ')[0] || ''}! 👋 Sono FO Coach, il tuo assistente nutrizionale.\n\nConosco il tuo piano per intero, le tue preferenze e cosa hai mangiato oggi. Ti propongo ricette sfiziose con calorie e macro calcolati sul database, alternative a pari calorie, e le aggiungo al diario con un click.\n\nCosa ti preparo oggi?`,
        id: 'welcome'
      }])
    }
  }

  async function addRecipeToDiary(recipe, mealType) {
    const entries = recipe.ingredienti.map(ing => ({
      client_id: profile.id,
      entry_date: today,
      meal_type: mealType,
      food_name: ing.nome,
      brand: null,
      quantity_g: ing.quantita_g,
      kcal: ing.kcal,
      protein_g: ing.p,
      carbs_g: ing.c,
      fat_g: ing.g,
    }))
    await dbSave(supabase.from('diary_entries').insert(entries), 'il diario', 'salvare', { done: 'Ricetta aggiunta al diario' })
  }

  const [status, setStatus] = useState('')
  async function saveAssistant(reply, recipe) {
    const row = { client_id: profile.id, role: 'assistant', content: reply }
    if (recipe) { const r = await supabase.from('ai_chat_messages').insert({ ...row, recipe }); if (!r.error) return }      // senza la colonna «recipe» (fofit-assistente.sql) il testo si salva lo stesso
    await dbSave(supabase.from('ai_chat_messages').insert(row), 'la chat', 'salvare', { silent: true })
  }

  async function sendMessage(text) {
    const userText = text || input.trim()
    if (!userText || loading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const userMsg = { role: 'user', content: userText, id: Date.now().toString() }
    const newMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg]
    const aiId = Date.now().toString() + '_ai'
    setMessages([...newMessages, { role: 'assistant', content: '', id: aiId }])
    setLoading(true); setStatus('')

    // il salvataggio del messaggio e la lettura del diario partono insieme alla richiesta: non la fanno aspettare
    const savedUser = dbSave(supabase.from('ai_chat_messages').insert({ client_id: profile.id, role: 'user', content: userText }), 'la chat', 'salvare', { silent: true })
    let acc = '', recipe = null, err = null, gap = false
    try {
      const ctx = await freshContext()
      const res = await authFetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.slice(-14).map(m => ({ role: m.role, content: m.content })), clientContext: ctx })
      })
      if (!res.ok) { let m = ''; try { m = (await res.json())?.error } catch {} throw new Error(m || 'Errore. Riprova!') }
      await readSse(res, ev => {
        if (ev.t === 'text') { acc += (gap && acc && !/\s$/.test(acc) ? '\n\n' : '') + ev.text; gap = false; setStatus(''); setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: acc } : m)) }
        else if (ev.t === 'status') { setStatus(ev.text); gap = true }
        else if (ev.t === 'recipe') recipe = ev.recipe
        else if (ev.t === 'error') err = ev.error
      })
    } catch (e) { err = e?.message && e.message !== 'Failed to fetch' ? e.message : 'Errore di connessione. Riprova.' }
    const reply = acc || err || 'Errore. Riprova!'
    setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: acc ? (err ? acc + '\n\n(Risposta interrotta: riprova se manca qualcosa.)' : acc) : reply, recipe } : m))
    setLoading(false); setStatus('')
    await savedUser
    if (acc) await saveAssistant(acc, recipe)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleInput(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
  }

  async function clearHistory() {
    await dbSave(supabase.from('ai_chat_messages').delete().eq('client_id', profile.id), 'la chat', 'eliminare', { done: 'Chat cancellata' })
    loadHistory()
  }

  function formatAIText(text) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('• ') || line.startsWith('* ') || line.startsWith('- ')) {
        return <div key={i} style={{paddingLeft:8,marginTop:3}}>{'• ' + line.slice(2)}</div>
      }
      const parts = line.split(/\*\*(.*?)\*\*/g)
      const formatted = parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)
      return <div key={i} style={{marginTop:line===''?6:0}}>{formatted}</div>
    })
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#D4570A,#F4894A)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <i className="ti ti-robot" style={{fontSize:18,color:'white'}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:500,color:'#F0F0F0'}}>FO Coach</div>
          <div style={{fontSize:11,color:'var(--green)',display:'flex',alignItems:'center',gap:6}}>
            <PulseDot color="#3B6D11"/>
            Assistente nutrizionale attivo
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button aria-label="Cancella la chat" onClick={clearHistory} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontFamily:'inherit'}}>
            <i className="ti ti-trash" style={{fontSize:16}}/>
          </button>
        </div>
      </div>

      {/* MESSAGGI */}
      <div style={s.page}>
        {messages.filter(msg => msg.content || msg.recipe).map(msg => (
          <div key={msg.id}>
            {msg.content && <div style={msg.role==='user'?s.msgUser:s.msgAI}>
              {msg.role==='assistant' ? formatAIText(msg.content) : msg.content}
            </div>}
            {/* Card ricetta se presente */}
            {msg.role==='assistant' && msg.recipe && (
              <RecipeCard recipe={msg.recipe} onAdd={addRecipeToDiary}/>
            )}
          </div>
        ))}
        {loading && !messages.some(m => m.id?.endsWith('_ai') && m.content) && (
          <div style={s.msgLoading} role="status" aria-label={status || 'Sto scrivendo'}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#D4570A',animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>
            ))}
            {status && <span style={{fontSize:11,color:'#AAA',marginLeft:6}}>{status}</span>}
          </div>
        )}
        {loading && status && messages.some(m => m.id?.endsWith('_ai') && m.content) && <div style={{fontSize:11,color:'#AAA',paddingLeft:6}} role="status">{status}</div>}
        <div ref={bottomRef}/>
      </div>

      {/* INPUT */}
      <div style={s.bottom}>
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:10,marginBottom:10}}>
          {SUGGERIMENTI.map((sg, i) => (
            <button key={i} onClick={()=>sendMessage(sg.text)} style={{
              background:'rgba(212,87,10,0.1)',color:'#F4894A',border:'0.5px solid #F4894A',
              borderRadius:20,padding:'6px 12px',fontSize:12,fontWeight:500,
              cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'
            }}>{sg.label}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <textarea ref={textareaRef} style={s.input}
            placeholder="Chiedi una ricetta o un consiglio..."
            value={input} onChange={handleInput} onKeyDown={handleKeyDown} rows={1}/>
          <button aria-label="Invia il messaggio" style={{...s.sendBtn,opacity:(!input.trim()||loading)?0.5:1}}
            onClick={()=>sendMessage()} disabled={!input.trim()||loading}>
            <i className="ti ti-send" style={{fontSize:16,color:'white'}}/>
          </button>
        </div>
      </div>

      {/* NAVIGAZIONE RAPIDA */}
      <div style={{padding:'8px 16px 12px',background:'#0D0D0D',borderTop:'0.5px solid #1A1A1A',display:'flex',gap:6,overflowX:'auto',flexShrink:0}}>
        {[
          {to:'/',icon:'ti-layout-dashboard',label:'Home'},
          {to:'/piano',icon:'ti-clipboard-list',label:'Piano'},
          {to:'/diario',icon:'ti-pencil',label:'Diario'},
          {to:'/progressi',icon:'ti-chart-line',label:'Progressi'},
          {to:'/spesa',icon:'ti-shopping-cart',label:'Spesa'},
        ].map(item=>(
          <button key={item.to} onClick={()=>navigate(item.to)}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'6px 12px',borderRadius:10,border:'0.5px solid #1C1C1C',background:'#161616',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
            <i className={`ti ${item.icon}`} style={{fontSize:16,color:'#D4570A'}}/>
            <span style={{fontSize:10,color:'#AAA',fontWeight:500}}>{item.label}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}`}</style>
    </div>
  )
}
