import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const STEPS = [
  {
    icon: 'ti-bolt',
    color: '#D4570A',
    bg: 'linear-gradient(135deg, #1a0800, #2d1400)',
    title: 'Benvenuto in FOfit!',
    sub: null,
    desc: 'La tua app di nutrizione personale, creata dal coach Federico Obinu. In pochi secondi ti spieghiamo come funziona.',
    cta: 'Inizia →',
  },
  {
    icon: 'ti-clipboard-list',
    color: '#D4570A',
    bg: '#FEF0E7',
    title: 'Il tuo piano alimentare',
    sub: 'Sempre con te',
    desc: 'Il tuo coach prepara un piano alimentare personalizzato per te. Trovi ogni pasto della settimana, con tutti gli ingredienti e le calorie già calcolate.',
    cta: 'Continua →',
  },
  {
    icon: 'ti-pencil',
    color: '#E8803A',
    bg: '#FEF3EC',
    title: 'Diario giornaliero',
    sub: 'Traccia ogni pasto',
    desc: 'Registra quello che mangi ogni giorno. Cerca tra centinaia di alimenti italiani, aggiungi le grammature e tieni tutto sotto controllo.',
    cta: 'Continua →',
  },
  {
    icon: 'ti-chart-line',
    color: '#3B8C5A',
    bg: '#EAF3DE',
    title: 'Tracker progressi',
    sub: 'Vedi i tuoi risultati',
    desc: 'Registra peso, misurazioni e foto. Vedi graficamente come stai progredendo settimana dopo settimana. I risultati ti motivano!',
    cta: 'Continua →',
  },
  {
    icon: 'ti-robot',
    color: '#9B59B6',
    bg: '#F5EEF8',
    title: 'FO Coach AI',
    sub: 'Il tuo assistente personale',
    desc: 'Chiedi sostituzioni creative, ricevi ricette sfiziose calibrate sui tuoi macro e aggiungile direttamente al diario con un click.',
    cta: 'Continua →',
  },
  {
    icon: 'ti-circle-check',
    color: '#3B8C5A',
    bg: '#EAF3DE',
    title: 'Tutto pronto!',
    sub: null,
    desc: 'Il tuo coach ha già preparato tutto per te. Inizia esplorando il tuo piano alimentare.',
    cta: '🚀 Entra in FOfit',
  },
]

export default function Onboarding() {
  const { profile, markOnboarded } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0
  const firstName = profile?.full_name?.split(' ')[0] || 'atleta'

  async function finish() {
    // Salva in localStorage che l'onboarding è stato completato
    localStorage.setItem(`fofit_onboarded_${profile.id}`, 'true')
    markOnboarded()
    navigate('/', { replace: true })
  }

  function next() {
    if (isLast) finish()
    else setStep(s => s + 1)
  }

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#F5F3EF',overflow:'hidden'}}>

      {/* HERO */}
      <div style={{
        background: isFirst ? current.bg : 'white',
        padding:'40px 28px 32px',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        flex: isFirst ? 1.2 : 0,
        minHeight: isFirst ? 0 : 220,
        position:'relative', overflow:'hidden', transition:'all 0.3s'
      }}>
        {isFirst && (
          <>
            <div style={{position:'absolute',top:-60,right:-60,width:220,height:220,borderRadius:'50%',background:'rgba(212,87,10,0.08)'}}/>
            <div style={{position:'absolute',bottom:-40,left:-40,width:150,height:150,borderRadius:'50%',background:'rgba(244,137,74,0.06)'}}/>
          </>
        )}

        {/* Icona */}
        <div style={{
          width: isFirst ? 88 : 72,
          height: isFirst ? 88 : 72,
          borderRadius: isFirst ? 24 : 20,
          background: isFirst ? 'linear-gradient(135deg,#D4570A,#F4894A)' : current.bg,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: isFirst ? '0 8px 24px rgba(212,87,10,0.4)' : '0 4px 12px rgba(0,0,0,0.08)',
          marginBottom:20, position:'relative', zIndex:1
        }}>
          <i className={`ti ${current.icon}`} style={{fontSize: isFirst ? 42 : 34, color: isFirst ? 'white' : current.color}}/>
        </div>

        {/* Titolo */}
        <div style={{textAlign:'center',position:'relative',zIndex:1}}>
          {current.sub && (
            <div style={{fontSize:12,fontWeight:600,color:current.color,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>
              {current.sub}
            </div>
          )}
          <div style={{
            fontSize: isFirst ? 26 : 22,
            fontWeight:700,
            color: isFirst ? 'white' : '#111',
            letterSpacing:-0.5, lineHeight:1.2, marginBottom: isFirst ? 0 : 4
          }}>
            {isFirst ? `Ciao, ${firstName}! 👋` : current.title}
          </div>
          {isFirst && (
            <div style={{fontSize:15,color:'rgba(255,255,255,0.6)',marginTop:8,fontWeight:500}}>
              {current.title}
            </div>
          )}
        </div>
      </div>

      {/* CONTENUTO */}
      <div style={{flex:1,display:'flex',flexDirection:'column',padding:'24px 28px',justifyContent:'space-between'}}>
        <div>
          <p style={{fontSize:15,color:'#444',lineHeight:1.7,textAlign:'center',margin:0}}>
            {current.desc}
          </p>

          {/* Dots indicatori */}
          <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:24}}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height:6, borderRadius:3, transition:'all 0.3s',
                background: i === step ? '#D4570A' : '#E0DDD6',
                width: i === step ? 20 : 6,
              }}/>
            ))}
          </div>
        </div>

        {/* Bottoni */}
        <div style={{marginTop:28}}>
          <button onClick={next} style={{
            width:'100%', padding:'16px', borderRadius:14,
            background:'linear-gradient(135deg,#D4570A,#F4894A)',
            color:'white', border:'none', fontSize:16, fontWeight:700,
            cursor:'pointer', fontFamily:'inherit', letterSpacing:-0.3,
            boxShadow:'0 4px 16px rgba(212,87,10,0.35)'
          }}>
            {current.cta}
          </button>

          {!isFirst && !isLast && (
            <button onClick={finish} style={{
              width:'100%', marginTop:12, padding:'12px',
              background:'none', border:'none', color:'#888780',
              fontSize:13, cursor:'pointer', fontFamily:'inherit'
            }}>
              Salta introduzione
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
