import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useNavigate } from 'react-router-dom'
import { PulseDot } from '../components/Animations'

const SUGGERIMENTI = [
  { label: '🍳 Ricetta con pollo', text: 'Dammi una ricetta sfiziosa con il pollo che rispetti i miei macro per il pranzo.' },
  { label: '🔄 Sostituisci alimento', text: 'Puoi aiutarmi a trovare un\'alternativa sfiziosa a un alimento del mio piano?' },
  { label: '📊 Analizza piano', text: 'Puoi analizzare il mio piano alimentare e dirmi se è bilanciato per il mio obiettivo?' },
  { label: '🥗 Piatto sfizioso', text: 'Suggeriscimi un piatto gustoso e creativo che rispetti i miei macro.' },
  { label: '🍝 Sostituzione carboidrati', text: 'Quali sono le migliori alternative ai carboidrati del mio piano, con grammature equivalenti?' },
]

const MEAL_SLOTS = ['colazione','spuntino','pranzo','pre-workout','cena','merenda']
const MEAL_LABELS = { colazione:'Colazione', spuntino:'Spuntino', pranzo:'Pranzo', 'pre-workout':'Pre-workout', cena:'Cena', merenda:'Merenda' }

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px 22px', display:'flex', flexDirection:'column', gap:12 },
  msgUser: { alignSelf:'flex-end', background:'#D4570A', color:'white', borderRadius:'14px 14px 4px 14px', padding:'10px 14px', maxWidth:'80%', fontSize:13, lineHeight:1.5 },
  msgAI: { alignSelf:'flex-start', background:'white', border:'0.5px solid #E0DDD6', borderRadius:'14px 14px 14px 4px', padding:'12px 14px', maxWidth:'88%', fontSize:13, lineHeight:1.7, color:'#111' },
  msgLoading: { alignSelf:'flex-start', background:'white', border:'0.5px solid #E0DDD6', borderRadius:'14px 14px 14px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center' },
  bottom: { padding:'12px 22px 20px', background:'white', borderTop:'0.5px solid #E0DDD6', flexShrink:0 },
  input: { flex:1, padding:'10px 14px', border:'0.5px solid #E0DDD6', borderRadius:22, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', resize:'none', maxHeight:100, lineHeight:1.5 },
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
    <div style={{background:'linear-gradient(135deg,#FEF0E7,#FEF8F4)',border:'0.5px solid #F4C9A8',borderRadius:12,padding:'14px',marginTop:8}}>
      {/* Header ricetta */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        <div style={{width:36,height:36,borderRadius:10,background:'#D4570A',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <i className="ti ti-chef-hat" style={{fontSize:18,color:'white'}}/>
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:'#111'}}>{recipe.titolo}</div>
          <div style={{fontSize:11,color:'#888780'}}>{recipe.kcal_totali} kcal · P{recipe.p_totali}g C{recipe.c_totali}g G{recipe.g_totali}g</div>
        </div>
      </div>

      {/* Ingredienti */}
      <div style={{marginBottom:12}}>
        {recipe.ingredienti.map((ing, i) => (
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid rgba(212,87,10,0.1)'}}>
            <span style={{fontSize:12,color:'#111'}}>{ing.nome}</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:11,color:'#888780'}}>{ing.quantita_g}g</span>
              <span style={{fontSize:11,color:'#D4570A',fontWeight:500}}>{ing.kcal} kcal</span>
            </div>
          </div>
        ))}
      </div>

      {/* Seleziona pasto + bottone */}
      {!added ? (
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select
            value={selectedMeal}
            onChange={e=>setSelectedMeal(e.target.value)}
            style={{flex:1,padding:'8px 10px',border:'0.5px solid #F4C9A8',borderRadius:8,fontSize:12,color:'#111',background:'white',outline:'none',fontFamily:'inherit'}}>
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
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#EAF3DE',borderRadius:8}}>
          <i className="ti ti-circle-check" style={{fontSize:16,color:'#3B6D11'}}/>
          <span style={{fontSize:12,color:'#3B6D11',fontWeight:500}}>Aggiunto a {MEAL_LABELS[selectedMeal]}!</span>
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
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (profile) { loadContext(); loadHistory() } }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  async function loadContext() {
    const { data: planData } = await supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()
    const { data: progress } = await supabase.from('progress_entries').select('*')
      .eq('client_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle()

    let pianoParsed = null
    if (planData) {
      const { data: meals } = await supabase.from('plan_meals')
        .select('*, plan_meal_foods(*)').eq('plan_id', planData.id).order('meal_order')
      const giorni = []
      for (let d = 1; d <= 7; d++) {
        const dayMeals = (meals || []).filter(m => m.day_of_week === d)
        if (dayMeals.length > 0) {
          giorni.push({
            giorno: ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][d-1],
            pasti: dayMeals.map(m => ({
              nome: m.meal_type,
              alimenti: (m.plan_meal_foods || []).map(f => ({
                nome: f.food_name, quantita_g: f.quantity_g,
                kcal: f.kcal, proteine_g: f.protein_g, carboidrati_g: f.carbs_g, grassi_g: f.fat_g,
              }))
            }))
          })
        }
      }
      pianoParsed = { giorni }
    }

    setClientContext({
      clientName: profile.full_name,
      goal: profile.goal,
      kcalTarget: planData?.kcal_target,
      proteinTarget: planData?.protein_target_g,
      carbsTarget: planData?.carbs_target_g,
      fatTarget: planData?.fat_target_g,
      plan: pianoParsed,
      recentProgress: progress,
    })
  }

  async function loadHistory() {
    const { data } = await supabase.from('ai_chat_messages').select('*')
      .eq('client_id', profile.id).order('created_at').limit(50)
    if (data && data.length > 0) {
      setMessages(data.map(m => ({ role: m.role, content: m.content, id: m.id, recipe: m.recipe || null })))
    } else {
      setMessages([{
        role: 'assistant',
        content: `Ciao ${profile.full_name?.split(' ')[0] || ''}! 👋 Sono FO Coach, il tuo assistente nutrizionale.\n\nPosso suggerirti ricette sfiziose calibrate sui tuoi macro e aggiungerle direttamente al tuo diario con un click. Posso anche aiutarti con sostituzioni creative o analizzare il tuo piano.\n\nCosa ti preparo oggi?`,
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
    await supabase.from('diary_entries').insert(entries)
  }

  async function sendMessage(text) {
    const userText = text || input.trim()
    if (!userText || loading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const userMsg = { role: 'user', content: userText, id: Date.now().toString() }
    const newMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg]
    setMessages(newMessages)
    setLoading(true)

    await supabase.from('ai_chat_messages').insert({
      client_id: profile.id, role: 'user', content: userText
    })

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          clientContext
        })
      })
      const data = await res.json()
      const reply = data.reply || 'Errore. Riprova!'
      const recipe = data.recipe || null

      const aiMsg = { role: 'assistant', content: reply, id: Date.now().toString() + '_ai', recipe }
      setMessages(prev => [...prev, aiMsg])

      await supabase.from('ai_chat_messages').insert({
        client_id: profile.id, role: 'assistant', content: reply
      })
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content:'Errore di connessione. Riprova.', id:'err' }])
    }
    setLoading(false)
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
    await supabase.from('ai_chat_messages').delete().eq('client_id', profile.id)
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
          <div style={{fontSize:15,fontWeight:500,color:'#111'}}>FO Coach</div>
          <div style={{fontSize:11,color:'#3B6D11',display:'flex',alignItems:'center',gap:6}}>
            <PulseDot color="#3B6D11"/>
            Assistente nutrizionale attivo
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={clearHistory} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontFamily:'inherit'}}>
            <i className="ti ti-trash" style={{fontSize:16}}/>
          </button>
        </div>
      </div>

      {/* MESSAGGI */}
      <div style={s.page}>
        {messages.map(msg => (
          <div key={msg.id}>
            <div style={msg.role==='user'?s.msgUser:s.msgAI}>
              {msg.role==='assistant' ? formatAIText(msg.content) : msg.content}
            </div>
            {/* Card ricetta se presente */}
            {msg.role==='assistant' && msg.recipe && (
              <RecipeCard recipe={msg.recipe} onAdd={addRecipeToDiary}/>
            )}
          </div>
        ))}
        {loading && (
          <div style={s.msgLoading}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#D4570A',animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>
            ))}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* INPUT */}
      <div style={s.bottom}>
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:10,marginBottom:10}}>
          {SUGGERIMENTI.map((sg, i) => (
            <button key={i} onClick={()=>sendMessage(sg.text)} style={{
              background:'#FEF0E7',color:'#D4570A',border:'0.5px solid #F4894A',
              borderRadius:20,padding:'6px 12px',fontSize:12,fontWeight:500,
              cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'
            }}>{sg.label}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <textarea ref={textareaRef} style={s.input}
            placeholder="Chiedi una ricetta o un consiglio..."
            value={input} onChange={handleInput} onKeyDown={handleKeyDown} rows={1}/>
          <button style={{...s.sendBtn,opacity:(!input.trim()||loading)?0.5:1}}
            onClick={()=>sendMessage()} disabled={!input.trim()||loading}>
            <i className="ti ti-send" style={{fontSize:16,color:'white'}}/>
          </button>
        </div>
      </div>

      {/* NAVIGAZIONE RAPIDA */}
      <div style={{padding:'8px 16px 12px',background:'white',borderTop:'0.5px solid #F5F3EF',display:'flex',gap:6,overflowX:'auto',flexShrink:0}}>
        {[
          {to:'/',icon:'ti-layout-dashboard',label:'Home'},
          {to:'/piano',icon:'ti-clipboard-list',label:'Piano'},
          {to:'/diario',icon:'ti-pencil',label:'Diario'},
          {to:'/progressi',icon:'ti-chart-line',label:'Progressi'},
          {to:'/spesa',icon:'ti-shopping-cart',label:'Spesa'},
        ].map(item=>(
          <button key={item.to} onClick={()=>navigate(item.to)}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'6px 12px',borderRadius:10,border:'0.5px solid #E0DDD6',background:'#F5F3EF',cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
            <i className={`ti ${item.icon}`} style={{fontSize:16,color:'#D4570A'}}/>
            <span style={{fontSize:10,color:'#888780',fontWeight:500}}>{item.label}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}`}</style>
    </div>
  )
}
