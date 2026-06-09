import React from 'react'
import { Link } from 'react-router-dom'

export default function DiarioGiornaliero() {
  return (
    <>
      <div style={{background:'white',borderBottom:'0.5px solid #E0DDD6',padding:'0 22px',height:56,display:'flex',alignItems:'center',flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:500,color:'#111'}}>DiarioGiornaliero</div>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:22}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:64,height:64,background:'#FEF0E7',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <i className="ti ti-tools-kitchen-2" style={{fontSize:32,color:'#D4570A'}} />
          </div>
          <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:8}}>Sezione in arrivo</div>
          <div style={{fontSize:13,color:'#888780',marginBottom:20}}>Questa sezione verrà completata nelle prossime sessioni.</div>
          <Link to="/" style={{background:'#D4570A',color:'white',padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:500,textDecoration:'none'}}>Torna alla Dashboard</Link>
        </div>
      </div>
    </>
  )
}
