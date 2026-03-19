import { cn } from '~/lib/utils'
import { RARITY_COLORS, RARITY_LABELS, type RarityType } from '~/lib/constants'

interface NeonPoolMeterProps {
  total: number
  remaining: number
  remainingByRarity: Record<string, number>
}

export function NeonPoolMeter({ total, remaining, remainingByRarity }: NeonPoolMeterProps) {
  const percentage = (remaining / total) * 100
  const isLow = remaining <= 10

  return (
    <div className="flex flex-col items-center gap-4">
      {/* LED numeric counter */}
      <div
        className={cn(
          'font-mono text-4xl font-bold tabular-nums',
          isLow ? 'text-red-500 led-flicker' : 'text-pachinko-gold'
        )}
      >
        {remaining}
      </div>
      <div className="text-xs text-white/50 uppercase tracking-widest">remaining</div>

      {/* Vertical LED tube */}
      <div className="relative w-8 h-48 bg-white/5 rounded-full border border-white/10 overflow-hidden">
        <div
          className={cn(
            'absolute bottom-0 w-full rounded-full transition-all duration-1000',
            isLow ? 'pulse-glow' : ''
          )}
          style={{
            height: `${percentage}%`,
            background:
              percentage > 50
                ? 'linear-gradient(to top, #00FF88, #2ECC71)'
                : percentage > 20
                  ? 'linear-gradient(to top, #FFB800, #FF8C00)'
                  : 'linear-gradient(to top, #FF2D78, #FF0000)',
            boxShadow:
              percentage > 50
                ? '0 0 10px #00FF88'
                : percentage > 20
                  ? '0 0 10px #FFB800'
                  : '0 0 10px #FF2D78',
          }}
        />
      </div>

      {/* Rarity breakdown bars */}
      <div className="w-full space-y-2">
        {Object.entries(remainingByRarity).map(([rarity, count]) => (
          <div key={rarity} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: RARITY_COLORS[rarity as RarityType] }}
            />
            <span className="text-white/60 flex-1 truncate">
              {RARITY_LABELS[rarity as RarityType] || rarity}
            </span>
            <span className="font-mono text-white/80">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
