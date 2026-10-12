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

  const icons = { success: 'ti-check', error: 'ti-alert-circle', info: 'ti-info-circle', warning: 'ti-alert-triangle' }
  const colors = { success: '#3B6D11', error: '#E24B4A', info: '#4A90D4', warning: '#E8A020' }
  const bgs = { success: '#EAF3DE', error: '#FEE2E2', info: '#EBF3FD', warning: '#FEF8E7' }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position:'fixed', bottom:'calc(env(safe-area-inset-bottom,0px) + 72px)', left:16, right:16, zIndex:9998, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: bgs[t.type], border: `0.5px solid ${colors[t.type]}`,
            borderRadius: 12, padding: '11px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
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
