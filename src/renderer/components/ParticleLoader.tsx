import { useEffect, useRef, useState } from 'react'

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  opacity: number
  hue: number
  angle: number
  radius: number
  speed: number
}

interface ParticleLoaderProps {
  onComplete: () => void
}

export function ParticleLoader({ onComplete }: ParticleLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const c = ctx // non-null alias for animate closure

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const cx = W / 2
    const cy = H / 2

    // Phase timing (ms)
    const PHASE_DURATIONS = {
      void: 1500,       // pure darkness, single point appears
      birth: 2000,      // single particle decomposes
      orbit: 3000,      // particles form rotating ring
      rush: 1500,       // ring rushes at camera
      flash: 400,       // white flash
    }

    let startTime = performance.now()
    let particles: Particle[] = []

    // Stars background
    const stars = Array.from({ length: 300 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005,
    }))

    function getPhase(t: number): string {
      let acc = 0
      for (const [name, dur] of Object.entries(PHASE_DURATIONS)) {
        acc += dur
        if (t < acc) return name
      }
      return 'done'
    }

    function getPhaseProgress(t: number): number {
      let acc = 0
      for (const [_key, dur] of Object.entries(PHASE_DURATIONS)) {
        acc += dur
        if (t < acc) {
          return Math.min((t - (acc - dur)) / dur, 1)
        }
      }
      return 1
    }

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3)
    }

    function easeInExpo(t: number) {
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10)
    }

    function animate(now: number) {
      const elapsed = now - startTime
      const phase = getPhase(elapsed)
      const pp = getPhaseProgress(elapsed) // phase progress 0-1

      // Background
      c.fillStyle = '#000000'
      c.fillRect(0, 0, W, H)

      // Subtle deep space gradient
      const bgGrad = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7)
      bgGrad.addColorStop(0, 'rgba(10, 5, 20, 0.3)')
      bgGrad.addColorStop(0.5, 'rgba(5, 2, 10, 0.2)')
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      c.fillStyle = bgGrad
      c.fillRect(0, 0, W, H)

      // Stars
      for (const star of stars) {
        star.twinkle += star.speed
        const alpha = 0.3 + 0.4 * Math.sin(star.twinkle)
        c.beginPath()
        c.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        c.fillStyle = `rgba(200, 210, 255, ${alpha})`
        c.fill()
      }

      // ?�?� PHASE: VOID ?�?�
      if (phase === 'void') {
        // Single bright point in center, slowly growing
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.003)
        const r = 2 + pulse * 3

        // Outer glow
        const glow = c.createRadialGradient(cx, cy, 0, cx, cy, r * 20)
        glow.addColorStop(0, `rgba(180, 140, 255, ${0.15 * pulse})`)
        glow.addColorStop(0.3, `rgba(100, 80, 200, ${0.05 * pulse})`)
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        c.fillStyle = glow
        c.beginPath()
        c.arc(cx, cy, r * 20, 0, Math.PI * 2)
        c.fill()

        // Core
        const core = c.createRadialGradient(cx, cy, 0, cx, cy, r)
        core.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
        core.addColorStop(0.5, 'rgba(200, 160, 255, 0.6)')
        core.addColorStop(1, 'rgba(120, 80, 220, 0)')
        c.fillStyle = core
        c.beginPath()
        c.arc(cx, cy, r, 0, Math.PI * 2)
        c.fill()
      }

      // ?�?� PHASE: BIRTH ?�?�
      if (phase === 'birth') {
        // Spawn particles from center
        const count = Math.floor(easeOutCubic(pp) * 600)
        while (particles.length < count) {
          const angle = Math.random() * Math.PI * 2
          const speed = Math.random() * 3 + 1
          const dist = Math.random() * 300 + 100
          particles.push({
            x: cx,
            y: cy,
            z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: (Math.random() - 0.5) * 2,
            size: Math.random() * 2.5 + 0.5,
            opacity: 0,
            hue: 240 + Math.random() * 80, // blue-purple range
            angle: angle,
            radius: dist,
            speed: speed * 0.02,
          })
        }

        // Draw particles
        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          p.z += p.vz
          p.opacity = Math.min(p.opacity + 0.02, 0.8)

          // Slow down
          p.vx *= 0.98
          p.vy *= 0.98

          const screenScale = 400 / (400 + p.z)
          const sx = cx + (p.x - cx) * screenScale
          const sy = cy + (p.y - cy) * screenScale
          const sr = p.size * screenScale

          // Glow
          const glow = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 6)
          glow.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${p.opacity * 0.4})`)
          glow.addColorStop(1, `hsla(${p.hue}, 80%, 70%, 0)`)
          c.fillStyle = glow
          c.beginPath()
          c.arc(sx, sy, sr * 6, 0, Math.PI * 2)
          c.fill()

          // Core
          c.beginPath()
          c.arc(sx, sy, sr, 0, Math.PI * 2)
          c.fillStyle = `hsla(${p.hue}, 90%, 80%, ${p.opacity})`
          c.fill()
        }

        // Center remnant glow
        const remAlpha = 1 - easeOutCubic(pp)
        if (remAlpha > 0) {
          const glow = c.createRadialGradient(cx, cy, 0, cx, cy, 40)
          glow.addColorStop(0, `rgba(255, 255, 255, ${remAlpha * 0.5})`)
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
          c.fillStyle = glow
          c.beginPath()
          c.arc(cx, cy, 40, 0, Math.PI * 2)
          c.fill()
        }
      }

      // ?�?� PHASE: ORBIT ?�?�
      if (phase === 'orbit') {
        // Guide particles into a rotating ring
        const ringRadius = Math.min(W, H) * 0.3
        const rotationSpeed = 0.015 + pp * 0.02

        // Ensure we have particles
        if (particles.length === 0) {
          for (let i = 0; i < 600; i++) {
            const angle = Math.random() * Math.PI * 2
            particles.push({
              x: cx + Math.cos(angle) * ringRadius,
              y: cy + Math.sin(angle) * ringRadius,
              z: (Math.random() - 0.5) * 100,
              vx: 0, vy: 0, vz: 0,
              size: Math.random() * 2 + 0.5,
              opacity: 0.8,
              hue: 240 + Math.random() * 80,
              angle: angle,
              radius: ringRadius * (0.8 + Math.random() * 0.4),
              speed: rotationSpeed * (0.8 + Math.random() * 0.4),
            })
          }
        }

        // Update ring
        for (const p of particles) {
          p.angle += p.speed
          const targetX = cx + Math.cos(p.angle) * p.radius
          const targetY = cy + Math.sin(p.angle) * p.radius

          // Ease towards ring position
          p.x += (targetX - p.x) * 0.08
          p.y += (targetY - p.y) * 0.08
          p.z *= 0.95

          // Pulsing opacity
          p.opacity = 0.5 + 0.5 * Math.sin(elapsed * 0.005 + p.angle * 3)

          const screenScale = 400 / (400 + p.z)
          const sx = cx + (p.x - cx) * screenScale
          const sy = cy + (p.y - cy) * screenScale
          const sr = p.size * screenScale

          // Glow
          const glow = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 8)
          glow.addColorStop(0, `hsla(${p.hue}, 90%, 75%, ${p.opacity * 0.5})`)
          glow.addColorStop(0.5, `hsla(${p.hue}, 80%, 60%, ${p.opacity * 0.15})`)
          glow.addColorStop(1, `hsla(${p.hue}, 80%, 60%, 0)`)
          c.fillStyle = glow
          c.beginPath()
          c.arc(sx, sy, sr * 8, 0, Math.PI * 2)
          c.fill()

          // Core
          c.beginPath()
          c.arc(sx, sy, sr, 0, Math.PI * 2)
          c.fillStyle = `hsla(${p.hue}, 95%, 85%, ${p.opacity})`
          c.fill()
        }

        // Inner glow of ring
        const innerGlow = c.createRadialGradient(cx, cy, 0, cx, cy, ringRadius * 0.5)
        innerGlow.addColorStop(0, `rgba(140, 100, 255, ${0.05 + pp * 0.08})`)
        innerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        c.fillStyle = innerGlow
        c.beginPath()
        c.arc(cx, cy, ringRadius * 0.5, 0, Math.PI * 2)
        c.fill()
      }

      // ?�?� PHASE: RUSH ?�?�
      if (phase === 'rush') {
        const rushProgress = easeInExpo(pp)
        const ringRadius = Math.min(W, H) * 0.3

        if (particles.length === 0) {
          for (let i = 0; i < 600; i++) {
            const angle = Math.random() * Math.PI * 2
            particles.push({
              x: cx + Math.cos(angle) * ringRadius,
              y: cy + Math.sin(angle) * ringRadius,
              z: 0,
              vx: 0, vy: 0, vz: 0,
              size: Math.random() * 2 + 0.5,
              opacity: 0.8,
              hue: 240 + Math.random() * 80,
              angle: angle,
              radius: ringRadius * (0.8 + Math.random() * 0.4),
              speed: 0.03,
            })
          }
        }

        for (const p of particles) {
          p.angle += p.speed
          p.z -= rushProgress * 800 // rush towards camera

          const targetX = cx + Math.cos(p.angle) * p.radius
          const targetY = cy + Math.sin(p.angle) * p.radius
          p.x += (targetX - p.x) * 0.1
          p.y += (targetY - p.y) * 0.1

          const screenScale = 400 / Math.max(400 + p.z, 10)
          const sx = cx + (p.x - cx) * screenScale
          const sy = cy + (p.y - cy) * screenScale
          const sr = p.size * screenScale

          // Brightness increases as it gets closer
          const brightness = Math.min(1, screenScale * 0.8)
          p.opacity = brightness

          // Glow
          const glowSize = sr * (8 + rushProgress * 12)
          const glow = c.createRadialGradient(sx, sy, 0, sx, sy, glowSize)
          glow.addColorStop(0, `hsla(${p.hue}, 100%, 80%, ${p.opacity * 0.6})`)
          glow.addColorStop(0.3, `hsla(${p.hue}, 90%, 70%, ${p.opacity * 0.2})`)
          glow.addColorStop(1, `hsla(${p.hue}, 80%, 60%, 0)`)
          c.fillStyle = glow
          c.beginPath()
          c.arc(sx, sy, glowSize, 0, Math.PI * 2)
          c.fill()

          // Core
          c.beginPath()
          c.arc(sx, sy, sr * (1 + rushProgress), 0, Math.PI * 2)
          c.fillStyle = `hsla(${p.hue}, 100%, 90%, ${p.opacity})`
          c.fill()
        }

        // Screen shake
        if (rushProgress > 0.5) {
          const shake = (rushProgress - 0.5) * 8
          canvas!.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`
        }

        // Vignette darkening
        const vigAlpha = rushProgress * 0.6
        const vig = c.createRadialGradient(cx, cy, Math.min(W, H) * 0.2, cx, cy, Math.max(W, H) * 0.7)
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
        vig.addColorStop(1, `rgba(0, 0, 0, ${vigAlpha})`)
        c.fillStyle = vig
        c.fillRect(0, 0, W, H)
      }

      // ?�?� PHASE: FLASH ?�?�
      if (phase === 'flash') {
        const flashAlpha = pp < 0.3 ? pp / 0.3 : 1 - (pp - 0.3) / 0.7
        c.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.9})`
        c.fillRect(0, 0, W, H)

        const textAlpha = pp > 0.5 ? (pp - 0.5) * 2 : 0
        if (textAlpha > 0) {
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.font = `bold ${Math.min(W, H) * 0.06}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
          c.fillStyle = `rgba(255, 255, 255, ${textAlpha})`
          c.fillText('OpenCode', cx, cy - 20)
          c.font = `${Math.min(W, H) * 0.02}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
          c.fillStyle = `rgba(200, 200, 220, ${textAlpha * 0.8})`
          c.fillText('Your OpenSource AI Agent', cx, cy + 30)
        }
      }

      if (phase === 'done') {
        c.fillStyle = 'rgba(0, 0, 0, 1)'
        c.fillRect(0, 0, W, H)
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.font = `bold ${Math.min(W, H) * 0.06}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        c.fillStyle = 'rgba(255, 255, 255, 1)'
        c.fillText('OpenCode', cx, cy - 20)
        c.font = `${Math.min(W, H) * 0.02}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        c.fillStyle = 'rgba(200, 200, 220, 0.8)'
        c.fillText('Your OpenSource AI Agent', cx, cy + 30)

        if (!done) {
          setDone(true)
          setTimeout(onComplete, 1500)
        }
      }

      // ?�?� PHASE: DONE ?�?�
      if (phase === 'done') {
        if (!done) {
          setDone(true)
          setTimeout(onComplete, 200)
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    const onResize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [done, onComplete])

  if (done) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black overflow-hidden cursor-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
