import { useEffect, useRef } from 'react'

interface ParticleExplosionProps {
  rarity: string
  active: boolean
}

const PARTICLE_CONFIGS: Record<string, { color: string; count: number; speed: number }> = {
  rare: { color: '#3498DB', count: 30, speed: 3 },
  ultra_rare: { color: '#9B59B6', count: 50, speed: 4 },
  secret_rare: { color: '#FFB800', count: 80, speed: 5 },
  last_one: { color: '#FF2D78', count: 120, speed: 6 },
}

export function ParticleExplosion({ rarity, active }: ParticleExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    const config = PARTICLE_CONFIGS[rarity] || PARTICLE_CONFIGS.rare!
    const particles: Array<{
      x: number; y: number; vx: number; vy: number
      size: number; alpha: number; color: string
    }> = []

    const cx = canvas.width / 2
    const cy = canvas.height / 2

    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = (Math.random() + 0.5) * config.speed
      const colors = rarity === 'last_one'
        ? ['#FF2D78', '#FFB800', '#00B4FF', '#00FF88', '#9B59B6']
        : rarity === 'secret_rare'
          ? ['#FFB800', '#FFA500', '#FFD700']
          : [config.color]

      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      })
    }

    let frame: number
    function animate() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      let alive = false

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.alpha -= 0.012
        if (p.alpha <= 0) continue
        alive = true

        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        ctx.shadowColor = p.color
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      ctx.globalAlpha = 1
      if (alive) {
        frame = requestAnimationFrame(animate)
      }
    }

    animate()
    return () => cancelAnimationFrame(frame)
  }, [active, rarity])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-20"
    />
  )
}
