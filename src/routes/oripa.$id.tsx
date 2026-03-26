import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'
import { PachinkoBoard } from '~/components/PachinkoBoard'
import { NeonPoolMeter } from '~/components/NeonPoolMeter'
import { DrawButton } from '~/components/DrawButton'
import { CardReveal } from '~/components/CardReveal'
import { LastOneAlert } from '~/components/LastOneAlert'
import { OripaCard } from '~/components/OripaCard'
import { fetchOripaDetail, fetchPoolStatus } from '~/server/oripa.functions'
import { handleX402Draw, type DrawResult } from '~/lib/x402-client'
import { useWallet } from '~/lib/wallet'
import { RARITY_COLORS, BUYBACK_RATES, type RarityType } from '~/lib/constants'

type DrawState = 'idle' | 'paying' | 'dropping' | 'revealing' | 'deciding' | 'complete'

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
    if (drawResult && drawResult.status === 'pending' && !drawResult.isLastOne) {
      setDrawState('deciding')
    } else {
      setDrawState('idle')
      setDrawResult(null)
    }
  }, [drawResult])

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
          ${oripa.pricePerDraw.toFixed(2)} USDC per draw
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

      {/* Keep / Buyback Decision Modal */}
      {drawState === 'deciding' && drawResult && (
        <DecisionModal
          drawResult={drawResult}
          userAddress={drawResult.userAddress}
          onDone={() => {
            setDrawState('idle')
            setDrawResult(null)
          }}
        />
      )}
    </div>
  )
}

function DecisionModal({
  drawResult,
  userAddress,
  onDone,
}: {
  drawResult: DrawResult
  userAddress: string
  onDone: () => void
}) {
  const [deciding, setDeciding] = useState(false)
  const [result, setResult] = useState<{
    action: string
    txHash?: string
    refundAmount?: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    if (!drawResult.decisionDeadline) return
    const deadline = new Date(drawResult.decisionDeadline).getTime()
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now())
      setTimeLeft(remaining)
      if (remaining <= 0) onDone()
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [drawResult.decisionDeadline, onDone])

  async function handleDecision(action: 'keep' | 'buyback') {
    setDeciding(true)
    setError(null)
    try {
      console.log('[decide] Sending:', { action, userAddress })
      const res = await fetch(`/api/draws/decide/${drawResult.drawId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userAddress }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        action?: string
        txHash?: string
        refundAmount?: number
      }
      if (!res.ok) throw new Error(data.error || 'Decision failed')
      setResult({ action: data.action!, txHash: data.txHash, refundAmount: data.refundAmount })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setDeciding(false)
    }
  }

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)
  const buybackRate = BUYBACK_RATES[drawResult.card.rarity] ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative z-10 bg-pachinko-bg border border-pachinko-gold/30 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        {/* Timer */}
        {!result && (
          <div className="text-center">
            <span className={`text-sm font-mono ${timeLeft < 60000 ? 'text-red-400 animate-pulse' : 'text-pachinko-gold'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
            <span className="text-white/40 text-xs ml-2">to decide</span>
          </div>
        )}

        {/* Card */}
        <div className="flex justify-center">
          <OripaCard card={drawResult.card} size="md" />
        </div>

        {!result ? (
          <>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-red-400 text-xs text-center">
                {error}
              </div>
            )}

            {/* Keep Button */}
            <button
              onClick={() => handleDecision('keep')}
              disabled={deciding}
              className="w-full py-3 bg-pachinko-green/10 border border-pachinko-green/50 rounded-xl text-pachinko-green font-bold text-sm hover:bg-pachinko-green/20 transition-all disabled:opacity-50"
            >
              {deciding ? 'Processing...' : 'KEEP — Mint as NFT'}
            </button>

            {/* Buyback Button */}
            <button
              onClick={() => handleDecision('buyback')}
              disabled={deciding}
              className="w-full py-3 bg-pachinko-pink/10 border border-pachinko-pink/50 rounded-xl text-pachinko-pink font-bold text-sm hover:bg-pachinko-pink/20 transition-all disabled:opacity-50"
            >
              {deciding
                ? 'Processing...'
                : `SELL BACK — ${(buybackRate * 100).toFixed(0)}% refund ($${drawResult.buybackAmount?.toFixed(4) ?? '0'})`}
            </button>

            <p className="text-white/30 text-[10px] text-center">
              Auto-keeps if you don't decide in time
            </p>

            <a
              href={`/verify?drawId=${drawResult.drawId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[10px] text-pachinko-blue/60 hover:text-pachinko-blue"
            >
              Draw #{drawResult.drawId} — Verify fairness
            </a>
          </>
        ) : (
          <div className="text-center space-y-3">
            <div
              className={`text-lg font-bold ${
                result.action === 'kept' ? 'text-pachinko-green' : 'text-pachinko-pink'
              }`}
            >
              {result.action === 'kept' ? 'KEPT — NFT Minted!' : 'SOLD BACK'}
            </div>

            {result.refundAmount != null && (
              <div className="text-sm text-white/60">
                Refund: ${result.refundAmount.toFixed(4)} USDC
              </div>
            )}

            {result.txHash && (
              <a
                href={`https://www.oklink.com/xlayer/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-pachinko-blue hover:underline block"
              >
                View on Explorer
              </a>
            )}

            <button
              onClick={onDone}
              className="w-full py-2 bg-white/10 rounded-lg text-white/70 text-sm hover:bg-white/20 transition-all"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
