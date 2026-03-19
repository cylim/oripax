import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { PachinkoBoard } from '~/components/PachinkoBoard'
import { NeonPoolMeter } from '~/components/NeonPoolMeter'
import { DrawButton } from '~/components/DrawButton'
import { CardReveal } from '~/components/CardReveal'
import { LastOneAlert } from '~/components/LastOneAlert'
import { fetchOripaDetail, fetchPoolStatus } from '~/server/oripa.functions'
import { handleX402Draw, type DrawResult } from '~/lib/x402-client'
import { useWallet } from '~/lib/wallet'
import { RARITY_COLORS, type RarityType } from '~/lib/constants'

type DrawState = 'idle' | 'paying' | 'dropping' | 'revealing' | 'complete'

const RARITY_TO_SLOT: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  ultra_rare: 3,
  secret_rare: 4,
}

export const Route = createFileRoute('/oripa/$id')({
  loader: ({ params }) => fetchOripaDetail({ data: { id: params.id } }),
  component: OripaDrawPage,
})

function OripaDrawPage() {
  const oripa = Route.useLoaderData()
  const { connected, connect, signPayment } = useWallet()
  const [drawState, setDrawState] = useState<DrawState>('idle')
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: poolStatus } = useQuery({
    queryKey: ['pool', oripa.id],
    queryFn: () => fetchPoolStatus({ data: { id: String(oripa.id) } }),
    refetchInterval: 3000,
  })

  const pool = poolStatus || oripa.pool

  const handleDraw = async () => {
    setError(null)

    if (!connected) {
      await connect()
      return
    }

    setDrawState('paying')

    try {
      const result = await handleX402Draw(oripa.id, signPayment)
      setDrawResult(result)
      setDrawState('dropping')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Draw failed'
      if (message.includes('USER_REJECTS') || message.includes('action-cancelled')) {
        setError('Transaction cancelled')
      } else {
        setError(message)
      }
      setDrawState('idle')
    }
  }

  const handleBallLand = useCallback(() => {
    setDrawState('revealing')
  }, [])

  const handleRevealClose = useCallback(() => {
    setDrawState('idle')
    setDrawResult(null)
  }, [])

  const targetSlot = drawResult
    ? RARITY_TO_SLOT[drawResult.card.rarity] ?? 0
    : undefined

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-pachinko-gold neon-glow mb-1">
          {oripa.name}
        </h1>
        <p className="text-white/50 text-sm">
          ${oripa.pricePerDraw.toFixed(2)} USDT per draw
        </p>
        <p className="text-yellow-400/70 text-xs mt-1">
          Demo pricing — real pools would be 50-500x higher
        </p>
      </div>

      {/* Last One Alert */}
      {pool && <LastOneAlert remaining={pool.remaining} />}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Pachinko Board */}
        <div className="flex-1">
          <PachinkoBoard
            onBallLand={handleBallLand}
            targetSlot={targetSlot}
            isDropping={drawState === 'dropping'}
          />
        </div>

        {/* Pool Info Sidebar */}
        <div className="w-full lg:w-64 space-y-6">
          {pool && (
            <NeonPoolMeter
              total={pool.total}
              remaining={pool.remaining}
              remainingByRarity={pool.remainingByRarity}
            />
          )}

          {/* Current Odds */}
          {pool?.currentOdds && (
            <div className="space-y-2">
              <h3 className="text-xs text-white/50 uppercase tracking-widest">Current Odds</h3>
              {Object.entries(pool.currentOdds).map(([rarity, odds]) => (
                <div key={rarity} className="flex justify-between text-xs">
                  <span style={{ color: RARITY_COLORS[rarity as RarityType] }}>
                    {rarity.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-white/70">{odds}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Draw Button */}
      <div className="flex flex-col items-center mt-8 gap-3">
        <DrawButton
          price={oripa.pricePerDraw}
          disabled={drawState !== 'idle'}
          loading={drawState === 'paying'}
          soldOut={oripa.status === 'sold_out'}
          onClick={handleDraw}
        />
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>

      {/* Card Reveal Modal */}
      <CardReveal
        card={drawResult?.card ?? null}
        isLastOne={drawResult?.isLastOne ?? false}
        onClose={handleRevealClose}
      />
    </div>
  )
}
