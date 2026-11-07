import React from 'react'
import { done, notify } from '../../lib/toast'
import { reportExtraHtml } from '../../lib/reportQuestions.js'
import { _initials } from './shared'

export function generateReportPDF(r, clientName, goal) {
  function bar(val, max, color) {
    const pct = Math.min(Math.round((val/max)*100),100)
    return '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:5px;background:#F0EDE8;border-radius:3px"><div style="height:5px;width:'+pct+'%;background:'+color+';border-radius:3px"></div></div><span style="font-size:11px;font-weight:700;color:'+color+';min-width:20px;text-align:right">'+val+'</span></div>'
  }
  function sc(v, inv) {
    if (v==null) return '#888780'
    if (inv) return v<=3?'#3B6D11':v<=6?'#E8A020':'#E24B4A'
    return v>=8?'#3B6D11':v>=5?'#E8A020':'#E24B4A'
  }
  var dateLabel = r.period_start&&r.period_end
    ? new Date(r.period_start+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long'})+' – '+new Date(r.period_end+'T12:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    : 'Inviato il '+new Date(r.submitted_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})

  var bw = r.benessere_generale!=null?'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">😊 Benessere</span><span style="font-weight:700;color:'+sc(r.benessere_generale)+'">'+r.benessere_generale+'/10</span></div>'+bar(r.benessere_generale,10,sc(r.benessere_generale))+'</div>':''
  var en = r.energia_allenamento!=null?'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">⚡ Energia</span><span style="font-weight:700;color:'+sc(r.energia_allenamento)+'">'+r.energia_allenamento+'/10</span></div>'+bar(r.energia_allenamento,10,sc(r.energia_allenamento))+'</div>':''
  var st = r.stress_periodo!=null?'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">🧠 Stress</span><span style="font-weight:700;color:'+sc(r.stress_periodo,true)+'">'+r.stress_periodo+'/10</span></div>'+bar(r.stress_periodo,10,sc(r.stress_periodo,true))+'</div>':''
  var rc = r.qualita_recupero!=null?'<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#888780">😴 Recupero</span><span style="font-weight:700;color:'+sc(r.qualita_recupero)+'">'+r.qualita_recupero+'/10</span></div>'+bar(r.qualita_recupero,10,sc(r.qualita_recupero))+'</div>':''

  var progHtml = ''
  if (r.progressi_esercizi&&r.progressi_esercizi.length) {
    progHtml = r.progressi_esercizi.map(function(ex){
      var diff=ex.carico_fine&&ex.carico_inizio?(parseFloat(ex.carico_fine)-parseFloat(ex.carico_inizio)).toFixed(1):null
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid #EEECE8;font-size:12px"><div><strong>'+ex.exercise_name+'</strong>'+(ex.note?'<br><span style="font-size:10px;color:#888780;font-style:italic">'+ex.note+'</span>':'')+'</div><div style="display:flex;align-items:center;gap:6px"><span style="color:#888780">'+(ex.carico_inizio||'—')+'→'+(ex.carico_fine||'—')+'kg</span>'+(diff!=null?'<span style="padding:2px 7px;border-radius:7px;font-size:10px;font-weight:700;background:'+(parseFloat(diff)>0?'#EAF3DE':parseFloat(diff)<0?'#FEE2E2':'#F5F3EF')+';color:'+(parseFloat(diff)>0?'#3B6D11':parseFloat(diff)<0?'#E24B4A':'#888780')+'">'+(parseFloat(diff)>0?'+':'')+diff+'kg</span>':'')+'</div></div>'
    }).join('')
  }

  var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Report — '+clientName+'</title>'
  html += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;font-size:13px}.header{background:linear-gradient(135deg,#1A1A1A,#2D2D2D);color:white;padding:28px 36px 24px}.brand{font-size:22px;font-weight:900;margin-bottom:20px;display:flex;justify-content:space-between}.brand span{color:#D4570A}.brand-meta{font-size:11px;opacity:0.6;text-align:right}.av{width:44px;height:44px;border-radius:50%;background:#D4570A;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;margin-right:10px;vertical-align:middle}.cn{font-size:19px;font-weight:800;vertical-align:middle}.cs{font-size:12px;opacity:0.6;margin-top:6px}.bp{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.5);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-left:10px;vertical-align:middle}.body{padding:28px 36px}.sec{margin-bottom:22px}.st{font-size:11px;font-weight:700;color:#D4570A;text-transform:uppercase;letter-spacing:0.1em;border-bottom:2px solid #FEF0E7;padding-bottom:6px;margin-bottom:12px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box{background:#F8F7F5;border-radius:10px;padding:14px;margin-bottom:8px;border:0.5px solid #EEECE8}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:0.5px solid #EEECE8;font-size:12px}.row:last-child{border-bottom:none}.k{color:#888780}.v{font-weight:600}.note{background:#FFF8F5;border:1px solid #FDDCC4;border-radius:10px;padding:12px;font-size:12px;line-height:1.7;color:#444;font-style:italic;margin-top:6px}.footer{margin-top:24px;padding:14px 36px;background:#F8F7F5;border-top:0.5px solid #EEECE8;display:flex;justify-content:space-between;font-size:10px;color:#888780}.footer strong{color:#D4570A}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>'
  html += '<div class="header"><div class="brand"><div>FO<span>fit</span></div><div class="brand-meta">Federico Obinu · Coach<br>fofit.fit</div></div>'
  html += '<div><div class="av">'+_initials(clientName)+'</div><span class="cn">'+clientName+'</span><span class="bp">Report allenamento</span></div>'
  html += '<div class="cs">'+dateLabel+'</div></div>'
  html += '<div class="body"><div class="g2"><div>'
  if (bw||en||st||rc) {
    html += '<div class="sec"><div class="st">😊 Benessere e performance</div><div class="box">'+bw+en+st+rc+'</div></div>'
  }
  if (r.sessioni_completate!=null||r.peso_inizio||r.peso_fine||r.ore_sonno_medie) {
    html += '<div class="sec"><div class="st">📋 Dati periodo</div><div class="box">'
    if (r.sessioni_completate!=null) html += '<div class="row"><span class="k">Sessioni completate</span><span class="v">'+r.sessioni_completate+(r.sessioni_pianificate?'/'+r.sessioni_pianificate:'')+'</span></div>'
    if (r.peso_inizio||r.peso_fine) html += '<div class="row"><span class="k">Peso</span><span class="v">'+(r.peso_inizio||'—')+'kg → '+(r.peso_fine||'—')+'kg</span></div>'
    if (r.ore_sonno_medie) html += '<div class="row"><span class="k">Sonno medio</span><span class="v">'+r.ore_sonno_medie+'h/notte</span></div>'
    html += '</div></div>'
  }
  if (progHtml) {
    html += '<div class="sec"><div class="st">📈 Progressi di carico</div><div class="box">'+progHtml+'</div></div>'
  }
  html += '</div><div>'
  if (r.difficolta_alimentazione||r.fame_saziet||r.pasti_saltati||r.note_alimentazione) {
    html += '<div class="sec"><div class="st">🥗 Alimentazione</div>'
    if (r.fame_saziet||r.pasti_saltati) {
      html += '<div class="box">'
      if (r.fame_saziet) html += '<div class="row"><span class="k">Fame/sazietà</span><span class="v">'+r.fame_saziet+'</span></div>'
      if (r.pasti_saltati) html += '<div class="row"><span class="k">Pasti saltati</span><span class="v">'+r.pasti_saltati+'</span></div>'
      html += '</div>'
    }
    if (r.difficolta_alimentazione) html += '<div class="note"><strong style="font-style:normal;color:#D4570A;font-size:10px;text-transform:uppercase">Difficoltà</strong><br>'+r.difficolta_alimentazione+'</div>'
    if (r.note_alimentazione) html += '<div class="note">'+r.note_alimentazione+'</div>'
    html += '</div>'
  }
  if (r.doms||r.zona_affaticata||r.dolori_nuovi) {
    html += '<div class="sec"><div class="st">💤 Recupero fisico</div><div class="box">'
    if (r.doms) html += '<div class="row"><span class="k">DOMS</span><span class="v">'+r.doms+'</span></div>'
    if (r.zona_affaticata) html += '<div class="row"><span class="k">Zona affaticata</span><span class="v">'+r.zona_affaticata+'</span></div>'
    if (r.dolori_nuovi) html += '<div class="row"><span class="k">Dolori nuovi</span><span class="v">'+r.dolori_nuovi+'</span></div>'
    html += '</div></div>'
  }
  if (r.esercizi_amati||r.esercizi_difficili||r.cosa_cambieresti||r.obiettivo_prossimo) {
    html += '<div class="sec"><div class="st">📋 Feedback scheda</div><div class="box">'
    if (r.esercizi_amati) html += '<div class="row"><span class="k">✅ Amati</span><span class="v">'+r.esercizi_amati+'</span></div>'
    if (r.esercizi_difficili) html += '<div class="row"><span class="k">😓 Difficili</span><span class="v">'+r.esercizi_difficili+'</span></div>'
    if (r.cosa_cambieresti) html += '<div class="row"><span class="k">💡 Migliorare</span><span class="v">'+r.cosa_cambieresti+'</span></div>'
    if (r.obiettivo_prossimo) html += '<div class="row"><span class="k">🎯 Prossimo</span><span class="v">'+r.obiettivo_prossimo+'</span></div>'
    html += '</div></div>'
  }
  if (r.note_coach) {
    html += '<div class="sec"><div class="st">💬 Note al coach</div><div class="note">"'+r.note_coach+'"</div></div>'
  }
  html += '</div></div>' + reportExtraHtml(r, { goal: goal }) + '</div>'
  html += '<div class="footer"><span>Generato il <strong>'+new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})+'</strong></span><span>FOfit · Federico Obinu Coach · <strong>fofit.fit</strong></span></div>'
  html += '</body></html>'

  var win = window.open('','_blank')
  if (!win) { notify('Il browser ha bloccato la finestra del PDF: consenti i popup e riprova', 'error'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(function(){win.print()},600)
  done('PDF pronto: stampa o salva')
}
