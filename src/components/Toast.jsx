import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  // Conferme (success): brevi (2 s) e una sola alla volta — una nuova sostituisce la precedente, così le azioni ripetute non si accumulano a pila.
  const show = useCallback((message, type = 'info', duration) => {
    const id = Date.now() + Math.random(), ms = duration || (type === 'success' ? 2200 : type === 'error' ? 4500 : 3000)
    setToasts(prev => [...(type === 'success' ? prev.filter(t => t.type !== 'success') : prev).slice(-2), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms)
  }, [])

  // Messaggi da qualunque punto dell'app (anche fuori dai componenti): window.dispatchEvent(new CustomEvent('fofit:toast', { detail: { message, type } }))
  useEffect(() => {
    const h = e => { if (e?.detail?.message) show(e.detail.message, e.detail.type || 'error', e.detail.duration) }
    window.addEventListener('fofit:toast', h)
    return () => window.removeEventListener('fofit:toast', h)
  }, [show])

  const icons = { success: 'ti-check', error: 'ti-alert-circle', info: 'ti-info-circle', warning: 'ti-alert-triangle' }
  const colors = { success: '#6FCF97', error: '#F07070', info: '#8CC2F5', warning: '#E8C050' }
  const bgs = { success: '#10231a', error: '#2a1414', info: '#11202e', warning: '#2a2210' }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position:'fixed', bottom:'calc(env(safe-area-inset-bottom,0px) + 72px)', left:16, right:16, zIndex:9998, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} style={{
            background: bgs[t.type], border: `0.5px solid ${colors[t.type]}`,
            borderRadius: t.type === 'success' ? 20 : 12, padding: t.type === 'success' ? '7px 14px' : '11px 14px',
            alignSelf: t.type === 'success' ? 'center' : 'stretch', maxWidth: '100%',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.2s ease-out',
            pointerEvents: 'auto',
          }}>
            <i className={`ti ${icons[t.type]}`} style={{ fontSize: t.type === 'success' ? 15 : 18, color: colors[t.type], flexShrink: 0 }} />
            <span style={{ fontSize: t.type === 'success' ? 12.5 : 13, fontWeight: 600, color: colors[t.type], lineHeight: 1.4 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
