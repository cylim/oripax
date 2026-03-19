import { cn } from '~/lib/utils'

interface LastOneAlertProps {
  remaining: number
}

export function LastOneAlert({ remaining }: LastOneAlertProps) {
  if (remaining > 5) return null

  const isUrgent = remaining <= 1

  return (
    <div
      className={cn(
        'w-full py-2 px-4 text-center font-bold text-sm animate-pulse rounded',
        isUrgent
          ? 'bg-gradient-to-r from-red-600 via-pachinko-gold to-red-600 text-white'
          : 'bg-gradient-to-r from-red-900/50 to-pachinko-gold/30 text-pachinko-pink'
      )}
    >
      <span className="mr-2">⚠️</span>
      ラストワン賞
      <span className="mx-2">•</span>
      LAST {remaining} SLOT{remaining !== 1 ? 'S' : ''}!
      <span className="ml-2">⚠️</span>
    </div>
  )
}
