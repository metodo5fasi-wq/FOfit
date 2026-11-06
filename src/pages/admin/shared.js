
export const s = {
  page: { flex:1, overflowY:'auto', padding:'16px 18px', background:'#080808' },
  topbar: { background:'#080808', borderBottom:'0.5px solid #111', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  btn: { background:'#D4570A', color:'white', border:'none', borderRadius:9, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' },
  btnSm: { background:'rgba(212,87,10,0.12)', color:'#F4894A', border:'0.5px solid rgba(212,87,10,0.25)', borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnGray: { background:'#161616', color:'#CCC', border:'0.5px solid #222', borderRadius:7, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' },
  tabs: { display:'flex', gap:5, marginBottom:16, flexWrap:'wrap' },
  tab: { padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'0.5px solid #222', background:'#0D0D0D', color:'#CCC' },
  tabActive: { padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', border:'0.5px solid rgba(212,87,10,0.4)', background:'rgba(212,87,10,0.15)', color:'#F4894A' },
  card: { background:'#0D0D0D', borderRadius:14, border:'0.5px solid #1C1C1C', padding:'16px', marginBottom:12 },
  cardTitle: { fontSize:12, fontWeight:700, color:'#F0F0F0', display:'flex', alignItems:'center', gap:7, marginBottom:14 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'8px 12px', fontSize:9, color:'#CCC', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'0.5px solid #1A1A1A', background:'#0A0A0A', fontWeight:700 },
  td: { padding:'10px 12px', borderBottom:'0.5px solid #111', color:'#C0C0C0', verticalAlign:'middle' },
  avatar: { width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#D4570A,#F4894A)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'white', marginRight:8, flexShrink:0 },
  badge: { fontSize:9, padding:'2px 8px', borderRadius:10, fontWeight:700 },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200, padding:0 },
  modalCard: { background:'#0D0D0D', borderRadius:'16px 16px 0 0', padding:'24px 20px', width:'100%', maxWidth:560, height:'90dvh', overflowY:'auto', WebkitOverflowScrolling:'touch', border:'0.5px solid #1C1C1C' },
  formGroup: { marginBottom:14 },
  label: { fontSize:10, color:'#CCC', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 },
  input: { width:'100%', padding:'9px 12px', border:'0.5px solid #222', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', border:'0.5px solid #222', borderRadius:8, fontSize:13, color:'#F0F0F0', background:'#161616', outline:'none', fontFamily:'inherit' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  saveBtn: { width:'100%', padding:11, background:'#D4570A', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  cancelBtn: { width:'100%', padding:11, background:'#161616', color:'#CCC', border:'0.5px solid #222', borderRadius:9, fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
}

export const goalLabel = { dimagrimento:'Dimagrimento', massa:'Massa muscolare', mantenimento:'Mantenimento', forza:'Forza', resistenza:'Resistenza', ricomposizione:'Ricomposizione corporea' }

export const initials = name => name ? name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'U'

export const today = new Date().toISOString().split('T')[0]

// Porta in vista un elemento e lo evidenzia per un momento (usato quando si arriva a un dato dalla dashboard)
export function flashEl(selector) {
  setTimeout(() => {
    const el = document.querySelector(selector); if (!el) return
    try { el.scrollIntoView?.({ behavior: 'smooth', block: 'center' }) } catch {}
    const old = el.style.boxShadow; el.style.boxShadow = '0 0 0 2px #D4570A, 0 0 18px rgba(212,87,10,0.45)'
    setTimeout(() => { el.style.boxShadow = old }, 2600)
  }, 220)
}

// ─────────────────────────────────────────────────────────
// PDF GENERATORS
// ─────────────────────────────────────────────────────────
export function _initials(n) { return n ? n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() : '?' }
