import React from 'react'
import { Link } from 'react-router-dom'

const placeholder = (icon, title, sub, links=[]) => () => (
  <>
    <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'0 22px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
      <div>
        <div style={{fontSize:15,fontWeight:500,color:'#111'}}>{title}</div>
        <div style={{fontSize:12,color:'#888780'}}>{sub}</div>
      </div>
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'18px 22px',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',maxWidth:320}}>
        <div style={{width:64,height:64,background:'#FEF0E7',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <i className={`ti ${icon}`} style={{fontSize:32,color:'#D4570A'}} />
        </div>
        <div style={{fontSize:16,fontWeight:500,color:'#111',marginBottom:8}}>{title}</div>
        <div style={{fontSize:13,color:'#888780',lineHeight:1.6,marginBottom:20}}>{sub}</div>
        {links.map(l => (
          <Link key={l.to} to={l.to} style={{display:'inline-block',background:'#D4570A',color:'white',padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:500,textDecoration:'none',margin:'4px'}}>{l.label}</Link>
        ))}
      </div>
    </div>
  </>
)

export const PianoAlimentare = placeholder('ti-clipboard-list','Piano alimentare','Il tuo piano alimentare settimanale personalizzato creato dal tuo coach.',[{to:'/diario',label:'Vai al diario'}])
export const DiarioGiornaliero = placeholder('ti-pencil','Diario giornaliero','Registra i pasti di oggi e tieni traccia delle calorie e dei macronutrienti.',[{to:'/piano',label:'Vedi il piano'}])
export const TrackerProgressi = placeholder('ti-chart-line','Tracker progressi','Monitora peso, misurazioni corporee e foto progressi settimana per settimana.',[{to:'/',label:'Torna alla dashboard'}])
export const ListaSpesa = placeholder('ti-shopping-cart','Lista della spesa','Lista della spesa settimanale generata automaticamente dal tuo piano alimentare.',[{to:'/piano',label:'Vedi il piano'}])
export const AssistenteAI = placeholder('ti-robot','Assistente AI','Il tuo assistente nutrizionale personale. Disponibile a breve nella versione completa.',[{to:'/',label:'Torna alla dashboard'}])
export const AdminPanel = placeholder('ti-settings','Pannello Admin','Gestisci i clienti, crea piani alimentari e monitora i loro progressi.',[{to:'/',label:'Torna alla dashboard'}])
