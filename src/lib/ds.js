// Design system condiviso FOfit
// Usato da tutte le pagine per eliminare duplicazione stili

export const ds = {
  // Card
  card: { background:'var(--bg-card)', borderRadius:12, border:'0.5px solid var(--border)', padding:'14px', marginBottom:12 },
  cardSm: { background:'var(--bg-card)', borderRadius:10, border:'0.5px solid var(--border)', padding:'10px', marginBottom:8 },

  // Typography
  label: { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600 },
  sectionTitle: { fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 },
  title: { fontSize:20, fontWeight:800, color:'var(--text)', letterSpacing:-0.3 },

  // Form
  input: { width:'100%', padding:'11px 13px', border:'0.5px solid var(--border)', borderRadius:10, fontSize:15, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', boxSizing:'border-box', WebkitAppearance:'none', transition:'border-color 0.15s' },
  select: { width:'100%', padding:'11px 13px', border:'0.5px solid var(--border)', borderRadius:10, fontSize:15, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', boxSizing:'border-box', WebkitAppearance:'none' },
  textarea: { width:'100%', padding:'11px 13px', border:'0.5px solid var(--border)', borderRadius:10, fontSize:15, color:'var(--text)', background:'var(--bg-input)', outline:'none', fontFamily:'inherit', resize:'vertical', lineHeight:1.6, boxSizing:'border-box', WebkitAppearance:'none' },

  // Buttons — min 44px height per tap target iOS
  btn: { background:'linear-gradient(135deg,#D4570A,#E8703A)', color:'white', border:'none', borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, minHeight:44, boxShadow:'0 2px 8px rgba(212,87,10,0.3)', transition:'all 0.15s', letterSpacing:'-0.01em' },
  btnSecondary: { background:'var(--bg-input)', color:'var(--text)', border:'0.5px solid var(--border)', borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, minHeight:44 },
  btnSm: { background:'var(--orange-light)', color:'var(--orange)', border:'0.5px solid var(--orange)', borderRadius:8, padding:'7px 13px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, minHeight:36 },
  btnGray: { background:'var(--bg-input)', color:'var(--text-muted)', border:'0.5px solid var(--border)', borderRadius:8, padding:'7px 13px', fontSize:12, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, minHeight:36 },
  btnDanger: { background:'#FEE2E2', color:'#E24B4A', border:'0.5px solid #E24B4A', borderRadius:8, padding:'7px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', minHeight:36 },
  btnGreen: { background:'#EAF3DE', color:'#3B6D11', border:'0.5px solid #3B6D11', borderRadius:8, padding:'7px 13px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, minHeight:36 },

  // Grid
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 },

  // Badge
  badge: (bg, color) => ({ display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:12, fontSize:11, fontWeight:600, background:bg, color }),

  // Topbar standard
  topbar: { background:'var(--bg-card)', borderBottom:'0.5px solid var(--border)', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },

  // Stat box
  statBox: { background:'var(--bg-input)', borderRadius:10, padding:'12px', textAlign:'center', border:'0.5px solid var(--border)' },
  statVal: (color='var(--orange)') => ({ fontSize:22, fontWeight:800, color, lineHeight:1.1, marginBottom:2 }),
  statLbl: { fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' },

  // Page scroll area
  page: { flex:1, overflowY:'auto', padding:'14px', WebkitOverflowScrolling:'touch' },

  // Chip selector
  chip: (active, color='#D4570A') => ({
    padding:'8px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer',
    border:'0.5px solid', fontFamily:'inherit', minHeight:36,
    background: active ? color : 'var(--bg-card)',
    color: active ? 'white' : 'var(--text-muted)',
    borderColor: active ? color : 'var(--border)',
    transition:'all 0.15s',
  }),
}

export default ds
