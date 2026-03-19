import { useEffect, useRef, useState } from 'react'
import { OripaCard } from './OripaCard'
import { ParticleExplosion } from './ParticleExplosion'
import { soundManager } from '~/lib/sounds'

interface CardRevealProps {
  card: {
    name: string
    rarity: string
    imageUri: string
    element: string
    attack: number
    defense: number
  } | null
  isLastOne: boolean
  onClose: () => void
}

export function CardReveal({ card, isLastOne, onClose }: CardRevealProps) {
  const [phase, setPhase] = useState<'flash' | 'flip' | 'reveal' | 'idle'>('idle')
  const [showParticles, setShowParticles] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!card) {
      setPhase('idle')
      return
    }

    // Start reveal sequence
    setPhase('flash')
    const isRarePlus = ['rare', 'ultra_rare', 'secret_rare', 'last_one'].includes(card.rarity)

    const t1 = setTimeout(() => {
      setPhase('flip')
      soundManager?.cardReveal()
    }, 300)

    const t2 = setTimeout(() => {
      setPhase('reveal')
      if (isRarePlus) {
        setShowParticles(true)
        if (isLastOne) {
          soundManager?.jackpot()
        } else {
          soundManager?.rarePull()
        }
      }
    }, 800)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [card, isLastOne])

  if (!card || phase === 'idle') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          phase === 'flash'
            ? 'bg-white'
            : 'bg-black/80 backdrop-blur-sm'
        }`}
      />

      {/* Card container */}
      <div className="relative z-10" ref={cardRef}>
        <div
          className="transition-transform duration-500"
          style={{
            transform: phase === 'flip'
              ? 'perspective(1000px) rotateY(90deg)'
              : phase === 'reveal'
                ? 'perspective(1000px) rotateY(0deg) scale(1.1)'
                : 'scale(0.8)',
            opacity: phase === 'flash' ? 0 : 1,
          }}
        >
          <OripaCard card={card} size="lg" />
        </div>

        {/* Last One banner */}
        {isLastOne && phase === 'reveal' && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-2xl font-bold text-pachinko-pink neon-glow-pink animate-pulse">
              🎊 ラストワン賞 🎊
            </span>
          </div>
        )}

        <ParticleExplosion
          rarity={isLastOne ? 'last_one' : card.rarity}
          active={showParticles}
        />
      </div>

      {/* Click to close hint */}
      {phase === 'reveal' && (
        <div className="absolute bottom-8 text-white/50 text-sm animate-pulse z-10">
          Click anywhere to continue
        </div>
      )}
    </div>
  )
}
