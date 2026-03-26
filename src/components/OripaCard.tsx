import { cn } from '~/lib/utils'
import { RARITY_COLORS, RARITY_LABELS, type RarityType } from '~/lib/constants'
import { HolographicShimmer } from './HolographicShimmer'

interface OripaCardProps {
  card: {
    name: string
    rarity: string
    imageUri: string
    element: string
  }
  size?: 'sm' | 'md' | 'lg'
}

export function OripaCard({ card, size = 'md' }: OripaCardProps) {
  const rarity = card.rarity as RarityType
  const color = RARITY_COLORS[rarity] || '#A0A0A0'
  const isShiny = ['rare', 'ultra_rare', 'secret_rare', 'last_one'].includes(rarity)

  const sizeClasses = {
    sm: 'w-32',
    md: 'w-48',
    lg: 'w-64',
  }

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden aspect-[5/7]',
        sizeClasses[size]
      )}
      style={{
        boxShadow: `0 0 15px ${color}40, 0 0 30px ${color}20`,
        border: `2px solid ${color}`,
      }}
    >
      {/* Card art area */}
      <div className="absolute inset-0 bg-gradient-to-br from-pachinko-bg to-white/5 flex items-center justify-center">
        {card.imageUri ? (
          <img
            src={card.imageUri}
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-6xl">🎴</div>
        )}
      </div>

      {/* Card info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3">
        <p className="text-white font-bold text-sm truncate">{card.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span
            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${color}30`, color }}
          >
            {RARITY_LABELS[rarity] || rarity}
          </span>
          <span className="text-[10px] text-white/50">{card.element}</span>
        </div>
      </div>

      {/* Holographic effect for rare+ */}
      {isShiny && <HolographicShimmer />}
    </div>
  )
}
