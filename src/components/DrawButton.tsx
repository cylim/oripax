import { cn } from '~/lib/utils'
import { soundManager } from '~/lib/sounds'

interface DrawButtonProps {
  price: number
  disabled?: boolean
  loading?: boolean
  soldOut?: boolean
  onClick: () => void
}

export function DrawButton({ price, disabled, loading, soldOut, onClick }: DrawButtonProps) {
  const handleClick = () => {
    if (disabled || loading || soldOut) return
    soundManager?.coinInsert()
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading || soldOut}
      className={cn(
        'relative px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 overflow-hidden',
        soldOut
          ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
          : disabled || loading
            ? 'bg-pachinko-gold/20 text-pachinko-gold/50 cursor-wait border border-pachinko-gold/20'
            : 'bg-gradient-to-b from-pachinko-gold to-amber-600 text-black hover:from-yellow-400 hover:to-amber-500 hover:shadow-[0_0_30px_rgba(255,184,0,0.5)] active:scale-95 border border-pachinko-gold'
      )}
    >
      {/* Coin slot visual */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-black/30 rounded-b" />

      {loading ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⏳</span> Processing...
        </span>
      ) : soldOut ? (
        'SOLD OUT'
      ) : (
        <>
          DRAW — ${price.toFixed(2)} USDC
        </>
      )}
    </button>
  )
}
