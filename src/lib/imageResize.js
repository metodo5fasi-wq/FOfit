// ─────────────────────────────────────────────────────────────
// Foto dei progressi: si ridimensionano PRIMA del caricamento.
// Una foto del telefono pesa 3–10 MB: viaggiava intera (lenta con poca rete) e le liste la scaricavano intera anche per una miniatura.
// Ora: lato lungo max 1600 px, JPEG qualità 0,82 (~250–500 KB, nitidissima a schermo) e una miniatura da 480 px (~30 KB) per le griglie.
// Se qualcosa non va (formato non leggibile, errore) si usa la foto originale: non si perde mai una foto per colpa della compressione.
// ─────────────────────────────────────────────────────────────
export const THUMB_SUFFIX = '-p_t.jpg'
export const isProcessedUrl = u => typeof u === 'string' && /-p\.jpg(\?.*)?$/.test(u)                       // "-p" = foto elaborata: ha la sua miniatura
export const thumbUrl = u => isProcessedUrl(u) ? u.replace(/-p\.jpg(\?.*)?$/, THUMB_SUFFIX + '$1') : u       // le foto vecchie non hanno miniatura: si usa l'originale
export const thumbPath = p => typeof p === 'string' ? p.replace(/-p\.jpg$/, THUMB_SUFFIX) : p
// per <img onError>: se la miniatura non c'è, si ricade sulla foto intera (una sola volta)
export function onThumbError(e) { const img = e.currentTarget; if (!img || img.dataset.fb || !img.dataset.full) return; img.dataset.fb = '1'; img.src = img.dataset.full }

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch {}                  // rispetta la rotazione della foto
    try { return await createImageBitmap(file) } catch {}
  }
  return await new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img) }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')) }; img.src = url })
}
const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(b => res(b), type, q))
function size(im) { return { w: im.naturalWidth || im.width, h: im.naturalHeight || im.height } }
async function draw(im, w, h, maxSide, quality) {
  const k = Math.min(1, maxSide / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k))
  const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch
  canvas.getContext('2d').drawImage(im, 0, 0, cw, ch)
  return { blob: await toBlob(canvas, 'image/jpeg', quality), w: cw, h: ch }
}
const looksImage = f => /^image\//.test(f?.type || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f?.name || '')

// Restituisce la foto ridimensionata (File .jpg) oppure l'ORIGINALE se non conviene o non si riesce.
export async function compressImage(file, { maxSide = 1600, quality = 0.82, skipBelow = 350 * 1024 } = {}) {
  let im = null
  try {
    if (!file || !looksImage(file)) return file
    im = await decode(file); const { w, h } = size(im)
    if (!w || !h) return file
    const fits = w <= maxSide && h <= maxSide
    if (fits && file.size <= skipBelow) return file                          // già piccola: non si ricodifica (niente perdita di qualità, niente lavoro inutile)
    const r = await draw(im, w, h, maxSide, quality); if (!r.blob) return file
    if (fits && r.blob.size >= file.size) return file                        // ricodificare non conviene
    return new File([r.blob], (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified || Date.now() })
  } catch { return file } finally { try { im?.close?.() } catch {} }
}
// Miniatura per le griglie; null se non si riesce (si userà la foto intera)
export async function makeThumb(file, { maxSide = 480, quality = 0.75 } = {}) {
  let im = null
  try { if (!file || !looksImage(file)) return null; im = await decode(file); const { w, h } = size(im); if (!w || !h) return null; return (await draw(im, w, h, maxSide, quality)).blob || null } catch { return null } finally { try { im?.close?.() } catch {} }
}
