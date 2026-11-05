import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  // Messaggi da qualunque punto dell'app (anche fuori dai componenti): window.dispatchEvent(new CustomEvent('fofit:toast', { detail: { message, type } }))
  useEffect(() => {
    const h = e => { if (e?.detail?.message) show(e.detail.message, e.detail.type || 'error', e.detail.duration || 4500) }
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
            borderRadius: 12, padding: '11px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.2s ease-out',
            pointerEvents: 'auto',
          }}>
            <i className={`ti ${icons[t.type]}`} style={{ fontSize: 18, color: colors[t.type], flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: colors[t.type], lineHeight: 1.4 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
