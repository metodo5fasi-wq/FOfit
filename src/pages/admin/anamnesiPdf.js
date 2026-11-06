import React from 'react'
import { _initials } from './shared'

export function generateAnamnesiPDF(a, clientName) {
  function field(label, value) {
    if (!value) return ''
    if (typeof value === 'string' && value.trim().charAt(0) === '[') {
      try { var parsed = JSON.parse(value); if (Array.isArray(parsed)) value = parsed } catch (e) {}
    }
    if (Array.isArray(value) && value.length === 0) return ''
    var v = Array.isArray(value) ? value.join(', ') : String(value)
    return '<div class="field"><div class="fl">'+label+'</div><div class="fv">'+v+'</div></div>'
  }
  function section(title, fields) {
    var content = fields.join('')
    if (!content) return ''
    return '<div class="sec"><div class="st">'+title+'</div>'+content+'</div>'
  }

  var dateLabel = a.completed_at
    ? 'Compilata il '+new Date(a.completed_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
    : (a.submitted_at ? 'Inviata il '+new Date(a.submitted_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}) : '')

  var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Anamnesi — '+clientName+'</title>'
  html += '<style>'
  html += '*{margin:0;padding:0;box-sizing:border-box}'
  html += 'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:#111;font-size:13px}'
  html += '.header{background:linear-gradient(135deg,#1A1A1A,#2D2D2D);color:white;padding:28px 36px 24px}'
  html += '.brand{font-size:22px;font-weight:900;margin-bottom:20px;display:flex;justify-content:space-between}'
  html += '.brand span{color:#3B6D11}'
  html += '.brand-meta{font-size:11px;opacity:0.6;text-align:right}'
  html += '.av{width:44px;height:44px;border-radius:50%;background:#3B6D11;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:white;margin-right:10px;vertical-align:middle}'
  html += '.cn{font-size:19px;font-weight:800;vertical-align:middle}'
  html += '.cs{font-size:12px;opacity:0.6;margin-top:6px}'
  html += '.bp{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.5);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;margin-left:10px;vertical-align:middle}'
  html += '.body{padding:28px 36px}'
  html += '.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}'
  html += '.sec{margin-bottom:20px}'
  html += '.st{font-size:11px;font-weight:700;color:#3B6D11;text-transform:uppercase;letter-spacing:0.1em;border-bottom:2px solid #EAF3DE;padding-bottom:6px;margin-bottom:12px}'
  html += '.field{margin-bottom:8px}'
  html += '.fl{font-size:10px;font-weight:700;color:#888780;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px}'
  html += '.fv{font-size:13px;color:#111;line-height:1.5;background:#F8F7F5;border-radius:8px;padding:8px 10px;border:0.5px solid #EEECE8}'
  html += '.highlight{background:#EAF3DE;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}'
  html += '.hval{font-size:20px;font-weight:900;color:#3B6D11;text-align:center}'
  html += '.hlbl{font-size:9px;color:#888780;text-transform:uppercase;letter-spacing:0.07em;text-align:center;margin-top:2px}'
  html += '.footer{margin-top:24px;padding:14px 36px;background:#F8F7F5;border-top:0.5px solid #EEECE8;display:flex;justify-content:space-between;font-size:10px;color:#888780}'
  html += '.footer strong{color:#3B6D11}'
  html += '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
  html += '</style></head><body>'

  // HEADER
  html += '<div class="header">'
  html += '<div class="brand"><div>FO<span>fit</span></div><div class="brand-meta">Federico Obinu · Coach<br>fofit.fit</div></div>'
  html += '<div><div class="av">'+_initials(clientName)+'</div><span class="cn">'+clientName+'</span><span class="bp">Anamnesi completa</span></div>'
  html += '<div class="cs">'+dateLabel+'</div>'
  html += '</div>'

  html += '<div class="body">'

  // KPI IN EVIDENZA
  var hasKpi = a.peso_attuale||a.peso_desiderato||a.altezza||a.frequenza_allenamento
  if (hasKpi) {
    html += '<div class="highlight">'
    if (a.peso_attuale) html += '<div><div class="hval">'+a.peso_attuale+'kg</div><div class="hlbl">Peso attuale</div></div>'
    if (a.peso_desiderato) html += '<div><div class="hval">'+a.peso_desiderato+'kg</div><div class="hlbl">Target</div></div>'
    if (a.altezza) html += '<div><div class="hval">'+a.altezza+'cm</div><div class="hlbl">Altezza</div></div>'
    if (a.frequenza_allenamento) html += '<div><div class="hval">'+a.frequenza_allenamento+'x</div><div class="hlbl">Sessioni/sett</div></div>'
    html += '</div>'
  }

  // LAYOUT 2 COLONNE
  html += '<div class="g2"><div>'

  html += section('1. Dati anagrafici', [
    field('Data di nascita', a.data_nascita),
    field('Città', a.citta),
    field('Lavoro', a.lavoro),
    field('Orari di lavoro', a.orari_lavoro),
  ])

  html += section('2. Obiettivo', [
    field('Obiettivo principale', a.obiettivo),
    field('Motivazione', a.motivazione),
    field('Tempistiche', a.tempo_cambiamento),
    field('Importanza (0-10)', a.importanza_obiettivo),
  ])

  html += section('3. Lavoro e stile di vita', [
    field('Tipo di lavoro', a.tipo_lavoro),
    field('Altro (specificato)', a.tipo_lavoro_altro),
    field('Ore seduto/a al giorno', a.ore_seduto),
    field('Ore consecutive senza alzarsi', a.ore_consecutive_seduto),
    field('Postazione di lavoro', a.postazione_lavoro),
    field('Pause attive', a.pause_attive),
    field('In cosa consistono le pause', a.tipo_pause),
    field('Come arriva al lavoro', a.mezzo_lavoro),
    field('Passi medi al giorno', a.passi_die),
    field('Sensazioni a fine giornata', a.sensazioni_fine_lavoro),
    field('Dopo il lavoro', a.dopo_lavoro),
  ])

  html += section('4. Postura e mal di schiena', [
    field('Mal di schiena', a.mal_schiena),
    field('Zona del dolore', a.zona_dolore_schiena),
    field('Da quanto tempo', a.durata_dolore_schiena),
    field('Intensità media (0-10)', a.intensita_dolore_schiena),
    field('Tipo di dolore', a.tipo_dolore_schiena),
    field('Quando peggiora', a.quando_peggio_schiena),
    field('Quando migliora', a.quando_meglio_schiena),
    field('Cosa dà sollievo', a.sollievo_schiena),
    field('Irradiazione', a.irradiazione_dolore),
    field('Esami / visite fatte', a.visite_schiena),
    field('Diagnosi', a.diagnosi_schiena),
    field('Impatto sulla vita quotidiana', a.impatto_schiena_vita),
    field('Traumi / incidenti', a.traumi_schiena),
    field('Dettaglio traumi', a.traumi_schiena_dettaglio),
    field('Correlazione con lo stress', a.stress_schiena),
    field('Postura abituale', a.postura_abituale),
    field('Postura alla scrivania', a.postura_scrivania),
    field('Posizione del monitor', a.posizione_monitor),
    field('Zone di tensione', a.zone_tensione),
    field('Tensione collo/spalle', a.frequenza_tensione_collo),
    field('Formicolii a braccia/mani', a.formicolio_mani),
    field('Stretching / mobilità', a.stretching_mobilita),
    field('Movimenti evitati', a.movimenti_evitati_dolore),
    field('Rapporto con la schiena (sue parole)', a.rapporto_schiena),
  ])

  html += section('5. Salute generale', [
    field('Diagnosi attive', a.diagnosi_attive),
    field('Interventi chirurgici', a.interventi_chirurgici),
    field('Condizioni particolari', a.condizioni_salute),
    field('Familiarità', a.familiarita),
  ])

  html += section('6. Farmaci e stimolanti', [
    field('Farmaci', a.farmaci),
    field('Integratori', a.integratori),
    field('Caffeina', a.caffeina),
    field('Fumo', a.fumo===true?'Sì':a.fumo===false?'No':null),
    field('Alcol', a.alcol),
  ])

  html += section('7. Sonno e recupero', [
    field('Ore di sonno', a.ore_sonno),
    field('Orario letto / sveglia', a.orario_letto&&a.orario_sveglia ? a.orario_letto+' → '+a.orario_sveglia : a.orario_letto||a.orario_sveglia),
    field('Qualità sonno', a.qualita_sonno ? a.qualita_sonno+'/10' : null),
    field('Risvegli notturni', a.risvegli_notte),
    field('Cosa rovina il sonno', a.cosa_rovina_sonno),
  ])

  html += section('8. Stress ed energia', [
    field('Stress medio', a.stress_medio ? a.stress_medio+'/10' : null),
    field('Crollo energia', a.crollo_energia),
    field('Sintomi frequenti', a.sintomi_frequenti),
    field('Fonti di stress', [a.fonte_stress_1, a.fonte_stress_2].filter(Boolean).join(', ')||null),
  ])

  html += '</div><div>'

  html += section('9. Digestione', [
    field('Gonfiore', a.gonfiore),
    field('Reflusso', a.reflusso),
    field('Evacuazione', a.evacuazione),
    field('Cibi che gonfiano', a.cibi_gonfiano),
  ])

  html += section('10. Storia peso', [
    field('Peso minimo (5 anni)', a.peso_minimo ? a.peso_minimo+'kg' : null),
    field('Peso massimo (5 anni)', a.peso_massimo ? a.peso_massimo+'kg' : null),
    field('Accumulo grasso', a.accumulo_grasso),
    field('Tentativi passati', a.tentativi_dieta),
    field('Perché non ha funzionato', a.perche_non_funzionato),
  ])

  html += section('11. Alimentazione', [
    field('Pasti preferiti', a.pasti_preferiti),
    field('Quando ha più fame', a.quando_fame),
    field('Giorno tipo', a.giorno_tipo),
    field('Acqua', a.acqua),
    field('Proteine gradite', a.proteine_gradite),
    field('Proteine non vuole', a.proteine_non_vuole),
    field('Carboidrati preferiti', a.carboidrati_preferiti),
    field('Piatti preferiti', a.piatti_preferiti),
    field('Cibi critici', a.cibi_critici),
    field('Livello tracking', a.livello_tracking),
  ])

  html += section('12. Allenamento', [
    field('Si allena', a.si_allena===true?'Sì':a.si_allena===false?'No':null),
    field('Tipologia', a.tipo_allenamento),
    field('Orario preferito', a.orario_allenamento),
    field('Durata sessione', a.durata_seduta),
    field('Energia in allenamento', a.energia_allenamento ? a.energia_allenamento+'/10' : null),
    field('DOMS', a.doms),
    field('Esercizi che ama', a.esercizi_ama),
    field('Esercizi che odia', a.esercizi_odia),
    field('Dolori/limitazioni', a.dolori_limitazioni),
  ])

  html += section('13. Vincoli e sostenibilità', [
    field('Tempo disponibile', a.tempo_settimana),
    field('Giorni migliori', a.giorni_migliori),
    field('Cibi da non togliere', a.cibi_non_togliere),
    field('Cosa non fare', a.cosa_non_fare),
  ])

  if (a.note_finali) {
    html += section('14. Note finali', [field('Note aggiuntive', a.note_finali)])
  }

  html += '</div></div>'
  html += '</div>'

  html += '<div class="footer"><span>Generato il <strong>'+new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})+'</strong></span><span>FOfit · Federico Obinu Coach · <strong>fofit.fit</strong></span></div>'
  html += '</body></html>'

  var win = window.open('','_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(function(){win.print()},600)
}
