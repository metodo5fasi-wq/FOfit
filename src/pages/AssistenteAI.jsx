import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const SUGGERIMENTI = [
  { label: '🔄 Sostituisci un alimento', text: 'Puoi aiutarmi a trovare un\'alternativa sfiziosa a un alimento del mio piano?' },
  { label: '📊 Analizza il mio piano', text: 'Puoi analizzare il mio piano alimentare e dirmi se è bilanciato per il mio obiettivo?' },
  { label: '🍳 Idee colazione creative', text: 'Dammi 3 idee creative e sfiziose per la colazione che rispettino i miei macro.' },
  { label: '🍝 Piatti sfiziosi con i miei macro', text: 'Suggeriscimi piatti gustosi e creativi che si adattino al mio piano alimentare.' },
  { label: '🥗 Sostituire i carboidrati', text: 'Quali sono le migliori alternative ai carboidrati del mio piano, con grammature equivalenti?' },
]

const s = {
  topbar: { background:'white', borderBottom:'0.5px solid #E0DDD6', padding:'0 22px', height:56, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  page: { flex:1, overflowY:'auto', padding:'16px 22px', display:'flex', flexDirection:'column', gap:12 },
  msgUser: { alignSelf:'flex-end', background:'#D4570A', color:'white', borderRadius:'14px 14px 4px 14px', padding:'10px 14px', maxWidth:'80%', fontSize:13, lineHeight:1.5 },
  msgAI: { alignSelf:'flex-start', background:'white', border:'0.5px solid #E0DDD6', borderRadius:'14px 14px 14px 4px', padding:'12px 14px', maxWidth:'85%', fontSize:13, lineHeight:1.7, color:'#111' },
  msgLoading: { alignSelf:'flex-start', background:'white', border:'0.5px solid #E0DDD6', borderRadius:'14px 14px 14px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center' },
  bottom: { padding:'12px 22px 20px', background:'white', borderTop:'0.5px solid #E0DDD6', flexShrink:0 },
  suggestRow: { display:'flex', gap:6, overflowX:'auto', paddingBottom:10, marginBottom:10 },
  suggestBtn: { background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #F4894A', borderRadius:20, padding:'6px 12px', fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' },
  inputRow: { display:'flex', gap:8, alignItems:'flex-end' },
  input: { flex:1, padding:'10px 14px', border:'0.5px solid #E0DDD6', borderRadius:22, fontSize:13, color:'#111', background:'#F5F3EF', outline:'none', fontFamily:'inherit', resize:'none', maxHeight:100, lineHeight:1.5 },
  sendBtn: { width:40, height:40, borderRadius:'50%', background:'#D4570A', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
}

export default function AssistenteAI() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientContext, setClientContext] = useState({})
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => { if (profile) { loadContext(); loadHistory() } }, [profile])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  async function loadContext() {
    // Carica piano attivo
    const { data: planData } = await supabase.from('meal_plans').select('*')
      .eq('client_id', profile.id).eq('is_active', true).limit(1).maybeSingle()

    // Carica progressi recenti
    const { data: progress } = await supabase.from('progress_entries').select('*')
      .eq('client_id', profile.id).order('entry_date', { ascending: false }).limit(1).maybeSingle()

    // Carica pasti del piano
    let pianoParsed = null
    if (planData) {
      const { data: meals } = await supabase.from('plan_meals')
        .select('*, plan_meal_foods(*)').eq('plan_id', planData.id).order('meal_order')

      // Organizza per giorni
      const giorni = []
      for (let d = 1; d <= 7; d++) {
        const dayMeals = (meals || []).filter(m => m.day_of_week === d)
        if (dayMeals.length > 0) {
          giorni.push({
            giorno: ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][d-1],
            pasti: dayMeals.map(m => ({
              nome: m.meal_type,
              alimenti: (m.plan_meal_foods || []).map(f => ({
                nome: f.food_name,
                quantita_g: f.quantity_g,
                kcal: f.kcal,
                proteine_g: f.protein_g,
                carboidrati_g: f.carbs_g,
                grassi_g: f.fat_g,
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
      setMessages(data.map(m => ({ role: m.role, content: m.content, id: m.id })))
    } else {
      // Messaggio di benvenuto
      setMessages([{
        role: 'assistant',
        content: `Ciao ${profile.full_name?.split(' ')[0] || ''}! 👋 Sono FO Coach, il tuo assistente nutrizionale personale.\n\nSono qui per aiutarti a rendere il tuo piano alimentare più sostenibile e sfizioso. Posso suggerire sostituzioni creative, proporti nuove idee di piatti con i tuoi macro, e analizzare il tuo piano.\n\nCosa posso fare per te oggi?`,
        id: 'welcome'
      }])
    }
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

    // Salva messaggio utente su Supabase
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
      const reply = data.reply || 'Mi dispiace, si è verificato un errore. Riprova!'

      const aiMsg = { role: 'assistant', content: reply, id: Date.now().toString() + '_ai' }
      setMessages(prev => [...prev, aiMsg])

      // Salva risposta AI su Supabase
      await supabase.from('ai_chat_messages').insert({
        client_id: profile.id, role: 'assistant', content: reply
      })
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content:'Errore di connessione. Riprova tra un momento.', id:'err' }])
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

  // Formatta il testo AI con grassetto e liste
  function formatAIText(text) {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      if (line.startsWith('• ') || line.startsWith('* ') || line.startsWith('- ')) {
        return <div key={i} style={{paddingLeft:8,marginTop:3}}>{'• ' + line.slice(2)}</div>
      }
      // Gestisce il grassetto **testo**
      const parts = line.split(/\*\*(.*?)\*\*/g)
      const formatted = parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)
      return <div key={i} style={{marginTop: line === '' ? 6 : 0}}>{formatted}</div>
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
          <div style={{fontSize:11,color:'#3B6D11',display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#3B6D11'}}/>
            Assistente nutrizionale attivo
          </div>
        </div>
        <button onClick={clearHistory} style={{background:'none',border:'none',cursor:'pointer',color:'#E0DDD6',fontSize:13,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
          <i className="ti ti-trash" style={{fontSize:14}}/>
        </button>
      </div>

      {/* MESSAGGI */}
      <div style={s.page}>
        {messages.map(msg => (
          <div key={msg.id} style={msg.role === 'user' ? s.msgUser : s.msgAI}>
            {msg.role === 'assistant' ? formatAIText(msg.content) : msg.content}
          </div>
        ))}
        {loading && (
          <div style={s.msgLoading}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width:7, height:7, borderRadius:'50%', background:'#D4570A',
                animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`
              }}/>
            ))}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* INPUT */}
      <div style={s.bottom}>
        {/* Suggerimenti rapidi */}
        <div style={s.suggestRow}>
          {SUGGERIMENTI.map((s, i) => (
            <button key={i} style={{
              background:'#FEF0E7', color:'#D4570A', border:'0.5px solid #F4894A',
              borderRadius:20, padding:'6px 12px', fontSize:12, fontWeight:500,
              cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit'
            }} onClick={() => sendMessage(s.text)}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={s.inputRow}>
          <textarea
            ref={textareaRef}
            style={s.input}
            placeholder="Scrivi un messaggio..."
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button style={{...s.sendBtn, opacity: (!input.trim()||loading)?0.5:1}}
            onClick={() => sendMessage()} disabled={!input.trim()||loading}>
            <i className="ti ti-send" style={{fontSize:16,color:'white'}}/>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0) }
          30% { transform: translateY(-8px) }
        }
      `}</style>
    </div>
  )
}
