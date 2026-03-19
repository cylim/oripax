import { Link } from '@tanstack/react-router'
import { cn } from '~/lib/utils'

interface VendingMachineProps {
  oripa: {
    id: number
    name: string
    totalSlots: number
    pricePerDraw: number
    status: string
    remaining: number
    lastOnePrize: { name: string; imageUri: string }
  }
}

export function VendingMachine({ oripa }: VendingMachineProps) {
  const isSoldOut = oripa.status === 'sold_out'
  const isNew = oripa.remaining > oripa.totalSlots * 0.9
  const percentage = (oripa.remaining / oripa.totalSlots) * 100

  return (
    <Link
      to="/oripa/$id"
      params={{ id: String(oripa.id) }}
      className={cn(
        'group relative block rounded-lg overflow-hidden border transition-all duration-300',
        isSoldOut
          ? 'border-white/10 opacity-60 cursor-not-allowed'
          : 'border-pachinko-gold/30 hover:border-pachinko-gold hover:shadow-[0_0_30px_rgba(255,184,0,0.3)]'
      )}
    >
      {/* Glass case */}
      <div className="relative bg-gradient-to-b from-white/5 to-transparent p-4">
        {/* NEW badge */}
        {isNew && !isSoldOut && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-pachinko-pink text-white text-xs font-bold rounded neon-glow-pink z-10">
            NEW
          </div>
        )}

        {/* Top prize display */}
        <div className="aspect-[5/7] bg-gradient-to-br from-pachinko-bg to-white/5 rounded flex items-center justify-center mb-3 overflow-hidden">
          <div className="text-center p-4">
            <div className="text-4xl mb-2">🎴</div>
            <p className="text-xs text-pachinko-gold/80 truncate">
              {oripa.lastOnePrize.name}
            </p>
            <p className="text-[10px] text-pachinko-pink mt-1">ラストワン賞</p>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-white truncate mb-2">{oripa.name}</h3>

        {/* LED remaining counter */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                isSoldOut
                  ? 'bg-red-500'
                  : percentage > 50
                    ? 'bg-green-500 led-flicker'
                    : percentage > 20
                      ? 'bg-amber-500 led-flicker'
                      : 'bg-red-500 led-flicker'
              )}
            />
            <span className="text-xs font-mono text-white/70">
              {oripa.remaining}/{oripa.totalSlots}
            </span>
          </div>
          <span className="text-xs font-bold text-pachinko-gold">
            ${oripa.pricePerDraw.toFixed(2)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              percentage > 50
                ? 'bg-green-500'
                : percentage > 20
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Status badge */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-2xl font-bold text-red-500 -rotate-12 border-2 border-red-500 px-4 py-1">
              SOLD OUT
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
