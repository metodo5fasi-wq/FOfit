import React, { useEffect, useState, useRef } from 'react'

// ─── CONFETTI ──────────────────────────────────────────────────────
export function Confetti({ active, onDone }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#D4570A','#F4894A','#FAC775','#3B8C5A','#9B59B6','#4A90D4','#E24B4A']
    particlesRef.current = Array.from({length: 80}, () => ({
      x: Math.random() * canvas.width,
      y: -10,
      r: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      opacity: 1,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }))

    let frame = 0
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        p.rotation += p.rotationSpeed
        p.opacity = Math.max(0, p.opacity - 0.008)
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation * Math.PI / 180)
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.r, -p.r/2, p.r * 2, p.r)
        }
        ctx.restore()
      })
      frame++
      if (frame < 180) {
        animRef.current = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onDone?.()
      }
    }
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [active])

  if (!active) return null
  return (
    <canvas ref={canvasRef} style={{
      position:'fixed', inset:0, pointerEvents:'none', zIndex:9998
    }}/>
  )
}

// ─── TOAST NOTIFICATION ────────────────────────────────────────────
export function Toast({ message, emoji, visible, color = '#D4570A' }) {
  return (
    <div style={{
      position:'fixed', bottom:100, left:'50%', transform:`translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      opacity: visible ? 1 : 0, transition:'all 0.3s ease',
      background:'#111', color:'white', borderRadius:20, padding:'10px 20px',
      fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8,
      boxShadow:'0 8px 24px rgba(0,0,0,0.25)', zIndex:9997, whiteSpace:'nowrap',
      pointerEvents:'none'
    }}>
      {emoji && <span style={{fontSize:16}}>{emoji}</span>}
      {message}
    </div>
  )
}

// ─── NUMERO ANIMATO ────────────────────────────────────────────────
export function AnimatedNumber({ value, duration = 600, suffix = '' }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const startRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (value === prevRef.current) return
    const from = prevRef.current
    const to = value
    prevRef.current = value
    startRef.current = null

    cancelAnimationFrame(rafRef.current)
    function animate(ts) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <>{display.toLocaleString('it-IT')}{suffix}</>
}

// ─── FADE IN PAGE ──────────────────────────────────────────────────
export function FadeIn({ children, delay = 0 }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`
    }}>
      {children}
    </div>
  )
}

// ─── PULSE DOT (online indicator) ─────────────────────────────────
export function PulseDot({ color = '#3B8C5A' }) {
  return (
    <div style={{position:'relative',width:8,height:8,flexShrink:0}}>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',background:color,animation:'pulse-ring 1.5s ease infinite'}}/>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',background:color}}/>
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:1}100%{transform:scale(2.5);opacity:0}}`}</style>
    </div>
  )
}

// ─── SKELETON LOADER ──────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, borderRadius = 8 }) {
  return (
    <div style={{
      width, height, borderRadius,
      background:'linear-gradient(90deg, #F5F3EF 25%, #EDEAE5 50%, #F5F3EF 75%)',
      backgroundSize:'200% 100%',
      animation:'shimmer 1.5s infinite'
    }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}
