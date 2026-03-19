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
  const engineRef = useRef<Matter.Engine | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cleanup: (() => void) | undefined

    async function init() {
      const Matter = await import('matter-js')
      const canvas = canvasRef.current
      if (!canvas) return

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = width
      canvas.height = height

      const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } })
      engineRef.current = engine

      // Walls
      const walls = [
        Matter.Bodies.rectangle(width / 2, -10, width, 20, { isStatic: true }),
        Matter.Bodies.rectangle(width / 2, height + 10, width, 20, { isStatic: true }),
        Matter.Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true }),
        Matter.Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true }),
      ]

      // Pegs in offset rows
      const pegs: Matter.Body[] = []
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
          pegs.push(
            Matter.Bodies.circle(x, y, 4, {
              isStatic: true,
              render: { fillStyle: '#FFB800' },
            })
          )
        }
      }

      // Slot dividers at bottom
      const slotWidth = width / 5
      const dividers: Matter.Body[] = []
      for (let i = 1; i < 5; i++) {
        dividers.push(
          Matter.Bodies.rectangle(i * slotWidth, height - 30, 4, 60, {
            isStatic: true,
          })
        )
      }

      Matter.Composite.add(engine.world, [...walls, ...pegs, ...dividers])

      // Render loop
      const ctx = canvas.getContext('2d')!
      let animFrame: number

      function draw() {
        Matter.Engine.update(engine, 1000 / 60)
        ctx.clearRect(0, 0, width, height)

        // Draw background
        ctx.fillStyle = '#0A0A0F'
        ctx.fillRect(0, 0, width, height)

        // Draw pegs
        for (const peg of pegs) {
          ctx.beginPath()
          ctx.arc(peg.position.x, peg.position.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#FFB800'
          ctx.fill()
          ctx.shadowColor = '#FFB800'
          ctx.shadowBlur = 6
          ctx.fill()
          ctx.shadowBlur = 0
        }

        // Draw slot labels
        for (let i = 0; i < 5; i++) {
          const x = i * slotWidth + slotWidth / 2
          const rarity = SLOT_LABELS[i]!
          ctx.fillStyle = RARITY_COLORS[rarity]
          ctx.font = '10px Orbitron'
          ctx.textAlign = 'center'
          ctx.fillText(rarity === 'ultra_rare' ? 'UR' : rarity === 'secret_rare' ? 'SR' : rarity[0]!.toUpperCase(), x, height - 8)
        }

        // Draw dividers
        for (const div of dividers) {
          ctx.fillStyle = '#333'
          ctx.fillRect(div.position.x - 2, div.position.y - 30, 4, 60)
        }

        // Draw dynamic bodies (balls)
        const bodies = Matter.Composite.allBodies(engine.world).filter(
          (b) => !b.isStatic
        )
        for (const body of bodies) {
          ctx.beginPath()
          ctx.arc(body.position.x, body.position.y, 8, 0, Math.PI * 2)
          ctx.fillStyle = '#FFB800'
          ctx.fill()
          ctx.shadowColor = '#FFB800'
          ctx.shadowBlur = 15
          ctx.fill()
          ctx.shadowBlur = 0
        }

        animFrame = requestAnimationFrame(draw)
      }

      draw()
      setLoaded(true)

      cleanup = () => {
        cancelAnimationFrame(animFrame)
        Matter.Engine.clear(engine)
      }
    }

    init()
    return () => cleanup?.()
  }, [])

  useEffect(() => {
    if (!isDropping || !engineRef.current || !canvasRef.current) return

    async function dropBall() {
      const Matter = await import('matter-js')
      const engine = engineRef.current!
      const canvas = canvasRef.current!
      const width = canvas.clientWidth

      // Bias the ball's starting x position toward the target slot
      const slotWidth = width / 5
      const target = targetSlot ?? Math.floor(Math.random() * 5)
      const targetX = target * slotWidth + slotWidth / 2
      const startX = targetX + (Math.random() - 0.5) * slotWidth * 0.5

      const ball = Matter.Bodies.circle(startX, 10, 8, {
        restitution: 0.5,
        friction: 0.1,
        density: 0.002,
      })

      Matter.Composite.add(engine.world, ball)
      soundManager?.ballDrop()

      // Listen for collisions for bounce sounds
      const collisionHandler = () => {
        soundManager?.ballBounce()
      }
      Matter.Events.on(engine, 'collisionStart', collisionHandler)

      // Check when ball settles
      const checkInterval = setInterval(() => {
        if (ball.position.y > canvas.clientHeight - 50 && Math.abs(ball.velocity.y) < 0.5) {
          clearInterval(checkInterval)
          Matter.Events.off(engine, 'collisionStart', collisionHandler)

          const landedSlot = Math.min(
            4,
            Math.max(0, Math.floor(ball.position.x / slotWidth))
          )
          setTimeout(() => {
            Matter.Composite.remove(engine.world, ball)
            onBallLand(landedSlot)
          }, 300)
        }
      }, 100)
    }

    dropBall()
  }, [isDropping, targetSlot, onBallLand])

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
