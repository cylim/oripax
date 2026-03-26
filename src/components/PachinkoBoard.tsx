import { useEffect, useRef, useState } from 'react'
import { soundManager } from '~/lib/sounds'
import { RARITY_COLORS, type RarityType } from '~/lib/constants'

interface PachinkoBoardProps {
  onBallLand: (slotIndex: number) => void
  targetSlot?: number
  isDropping: boolean
}

const SLOT_LABELS: RarityType[] = ['common', 'uncommon', 'rare', 'ultra_rare', 'secret_rare']

export function PachinkoBoard({ onBallLand, targetSlot, isDropping }: PachinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{
    engine: any
    Matter: any
    width: number
    height: number
    slotWidth: number
    pegs: any[]
    dividers: any[]
    settledBalls: { x: number; y: number }[]
    activeBall: any | null
    ready: boolean
  }>({
    engine: null,
    Matter: null,
    width: 0,
    height: 0,
    slotWidth: 0,
    pegs: [],
    dividers: [],
    settledBalls: [],
    activeBall: null,
    ready: false,
  })
  const onBallLandRef = useRef(onBallLand)
  onBallLandRef.current = onBallLand
  const [loaded, setLoaded] = useState(false)

  // Init engine + render loop
  useEffect(() => {
    let animFrame: number
    let cancelled = false
    const s = stateRef.current

    async function init() {
      const Matter = await import('matter-js')
      if (cancelled) return

      const canvas = canvasRef.current
      if (!canvas) return

      const container = canvas.parentElement!
      const dpr = window.devicePixelRatio || 1
      const width = container.clientWidth
      const height = container.clientHeight
      if (width === 0 || height === 0) return

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      const slotWidth = width / 5
      const engine = Matter.Engine.create({ gravity: { x: 0, y: 2 } })

      // Walls
      const walls = [
        Matter.Bodies.rectangle(width / 2, -10, width, 20, { isStatic: true }),
        Matter.Bodies.rectangle(width / 2, height + 10, width, 20, { isStatic: true, restitution: 0, friction: 1 }),
        Matter.Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true }),
        Matter.Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true }),
      ]

      // Pegs
      const pegs: any[] = []
      const pegRows = 8
      const pegCols = 7
      const pegSpacingX = width / (pegCols + 1)
      const pegSpacingY = (height - 120) / (pegRows + 1)

      for (let row = 0; row < pegRows; row++) {
        const offset = row % 2 === 0 ? 0 : pegSpacingX / 2
        const cols = row % 2 === 0 ? pegCols : pegCols - 1
        for (let col = 0; col < cols; col++) {
          const x = pegSpacingX + col * pegSpacingX + offset
          const y = 60 + row * pegSpacingY
          pegs.push(Matter.Bodies.circle(x, y, 4, { isStatic: true, restitution: 0.6 }))
        }
      }

      // Slot dividers
      const dividers: any[] = []
      for (let i = 1; i < 5; i++) {
        dividers.push(
          Matter.Bodies.rectangle(i * slotWidth, height - 30, 4, 60, { isStatic: true, restitution: 0, friction: 1 })
        )
      }

      Matter.Composite.add(engine.world, [...walls, ...pegs, ...dividers])

      // Save state
      s.Matter = Matter
      s.engine = engine
      s.width = width
      s.height = height
      s.slotWidth = slotWidth
      s.pegs = pegs
      s.dividers = dividers
      s.ready = true

      // Render loop — fixed 60fps timestep
      function draw() {
        if (cancelled) return

        Matter.Engine.update(engine, 1000 / 60)

        ctx.clearRect(0, 0, width, height)

        // Background
        ctx.fillStyle = '#0A0A0F'
        ctx.fillRect(0, 0, width, height)

        // Pegs
        ctx.shadowColor = '#FFB800'
        ctx.shadowBlur = 6
        ctx.fillStyle = '#FFB800'
        for (const peg of pegs) {
          ctx.beginPath()
          ctx.arc(peg.position.x, peg.position.y, 4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0

        // Dividers
        ctx.fillStyle = '#333'
        for (const div of dividers) {
          ctx.fillRect(div.position.x - 2, div.position.y - 30, 4, 60)
        }

        // Slot labels
        ctx.font = '10px Orbitron'
        ctx.textAlign = 'center'
        for (let i = 0; i < 5; i++) {
          const x = i * slotWidth + slotWidth / 2
          const rarity = SLOT_LABELS[i]!
          ctx.fillStyle = RARITY_COLORS[rarity]
          const label = rarity === 'ultra_rare' ? 'UR' : rarity === 'secret_rare' ? 'SR' : rarity[0]!.toUpperCase()
          ctx.fillText(label, x, height - 8)
        }

        // Settled balls
        ctx.fillStyle = '#FFB800'
        ctx.shadowColor = '#FFB800'
        ctx.shadowBlur = 10
        for (const pos of s.settledBalls) {
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2)
          ctx.fill()
        }

        // Active ball
        const ball = s.activeBall
        if (ball) {
          ctx.shadowBlur = 15
          ctx.beginPath()
          ctx.arc(ball.position.x, ball.position.y, 8, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0

        animFrame = requestAnimationFrame(draw)
      }

      animFrame = requestAnimationFrame(draw)
      setLoaded(true)
    }

    init()
    return () => {
      cancelled = true
      cancelAnimationFrame(animFrame)
      if (s.engine && s.Matter) {
        s.Matter.Engine.clear(s.engine)
      }
    }
  }, [])

  // Drop ball
  useEffect(() => {
    if (!isDropping) return

    const s = stateRef.current
    if (!s.ready) return

    const { Matter, engine, width, height, slotWidth } = s

    const target = targetSlot ?? Math.floor(Math.random() * 5)
    const targetX = target * slotWidth + slotWidth / 2
    const startX = targetX + (Math.random() - 0.5) * slotWidth * 0.4

    const ball = Matter.Bodies.circle(startX, 15, 8, {
      restitution: 0.4,
      friction: 0.05,
      density: 0.001,
      frictionAir: 0.01,
    })

    Matter.Composite.add(engine.world, ball)
    s.activeBall = ball
    soundManager?.ballDrop()

    // Bounce sounds
    let lastBounceTime = 0
    const collisionHandler = () => {
      const now = Date.now()
      if (now - lastBounceTime > 80) {
        lastBounceTime = now
        soundManager?.ballBounce()
      }
    }
    Matter.Events.on(engine, 'collisionStart', collisionHandler)

    // Steer toward target
    const nudgeInterval = setInterval(() => {
      const dx = targetX - ball.position.x
      const progress = Math.min(ball.position.y / height, 1)
      const strength = 0.00001 + progress * 0.00003
      Matter.Body.applyForce(ball, ball.position, { x: dx * strength, y: 0 })
    }, 16)

    // Check settle
    let settled = false
    const checkInterval = setInterval(() => {
      if (settled) return

      const nearBottom = ball.position.y > height - 55
      const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2)

      if (nearBottom && speed < 2) {
        settled = true
        clearInterval(checkInterval)
        clearInterval(nudgeInterval)
        Matter.Events.off(engine, 'collisionStart', collisionHandler)

        s.settledBalls.push({ x: ball.position.x, y: ball.position.y })
        Matter.Composite.remove(engine.world, ball)
        s.activeBall = null
        onBallLandRef.current(target)
      }
    }, 100)

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (!settled) {
        settled = true
        clearInterval(checkInterval)
        clearInterval(nudgeInterval)
        Matter.Events.off(engine, 'collisionStart', collisionHandler)
        s.settledBalls.push({ x: ball.position.x, y: ball.position.y })
        Matter.Composite.remove(engine.world, ball)
        s.activeBall = null
        onBallLandRef.current(target)
      }
    }, 8000)

    return () => {
      clearInterval(checkInterval)
      clearInterval(nudgeInterval)
      clearTimeout(safetyTimeout)
      Matter.Events.off(engine, 'collisionStart', collisionHandler)
    }
  }, [isDropping, targetSlot])

  return (
    <div className="relative w-full aspect-[3/4] max-w-md mx-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg border border-pachinko-gold/20"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-pachinko-bg/80 rounded-lg">
          <span className="text-pachinko-gold animate-pulse">Loading...</span>
        </div>
      )}
    </div>
  )
}
