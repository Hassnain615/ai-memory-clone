import { useEffect, useRef } from 'react'

/**
 * Animated "memory constellation" for the landing hero: drifting fragments that link up
 * when close, with an aura that follows the pointer. Honors prefers-reduced-motion.
 */
export default function Constellation({ className = '', density = 70 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 }
    let nodes = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(density * Math.min(1, (w * h) / (1200 * 700)) + 18)
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: i % 9 === 0 ? 2.6 : Math.random() * 1.4 + 0.6,
        hue: Math.random() < 0.55 ? 'blue' : 'cyan',
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      pointer.x += (pointer.tx - pointer.x) * 0.08
      pointer.y += (pointer.ty - pointer.y) * 0.08
      const linkDist = Math.min(150, w / 7)

      for (const n of nodes) {
        if (!reduce) {
          n.x += n.vx; n.y += n.vy
          const dx = pointer.x - n.x, dy = pointer.y - n.y
          const d2 = dx * dx + dy * dy
          if (d2 < 220 * 220) { n.x += dx * 0.0025; n.y += dy * 0.0025 }
          if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20
          if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < linkDist) {
            const near = Math.hypot(pointer.x - a.x, pointer.y - a.y) < 200
            ctx.strokeStyle = near ? `rgba(125,231,255,${(1 - d / linkDist) * 0.55})` : `rgba(91,140,255,${(1 - d / linkDist) * 0.18})`
            ctx.lineWidth = near ? 0.9 : 0.6
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        const color = n.hue === 'blue' ? '91,140,255' : '125,231,255'
        if (n.r > 2) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 14)
          g.addColorStop(0, `rgba(${color},.55)`); g.addColorStop(1, `rgba(${color},0)`)
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 14, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = `rgba(${color},.95)`
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      pointer.tx = e.clientX - rect.left; pointer.ty = e.clientY - rect.top
    }
    const onLeave = () => { pointer.tx = -9999; pointer.ty = -9999 }

    resize(); draw()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [density])

  return <canvas ref={ref} className={className} aria-hidden />
}
