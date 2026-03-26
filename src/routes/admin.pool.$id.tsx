import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface PoolDetail {
  id: number
  name: string
  status: string
  totalSlots: number
  pricePerDraw: number
  remaining: number
  pulled: number
  revenue: number
  pendingDraws: number
  totalDraws: number
  createdAt: string
  lastOnePrize: { cardId: number; name: string; imageUri: string }
}

export const Route = createFileRoute('/admin/pool/$id')({
  component: PoolManagePage,
})

function PoolManagePage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: pool, isLoading } = useQuery<PoolDetail>({
    queryKey: ['admin', 'oripa', id],
    queryFn: async () => {
      // Use the list endpoint and find by ID (simpler than adding a separate detail endpoint)
      const res = await fetch('/api/admin/oripas', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch')
      const pools: PoolDetail[] = await res.json()
      const found = pools.find((p) => p.id === parseInt(id, 10))
      if (!found) throw new Error('Pool not found')
      return found
    },
    refetchInterval: 5000,
  })

  if (isLoading || !pool) {
    return (
      <div className="text-center text-pachinko-gold animate-pulse py-12">
        Loading pool...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="text-gray-500 hover:text-gray-400 text-sm">
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-pachinko-gold">{pool.name}</h1>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            pool.status === 'active'
              ? 'bg-pachinko-green/10 text-pachinko-green border-pachinko-green/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          {pool.status}
        </span>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Slots" value={pool.totalSlots} />
        <StatCard label="Remaining" value={pool.remaining} />
        <StatCard label="Pulled" value={pool.pulled} />
        <StatCard label="Revenue" value={`$${pool.revenue.toFixed(2)}`} />
        <StatCard label="Pending" value={pool.pendingDraws} highlight={pool.pendingDraws > 0} />
      </div>

      {/* Pool Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-xl p-4 space-y-2">
          <div className="text-xs text-gray-500">Pool Details</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Price per Draw</span>
              <span className="text-white">${pool.pricePerDraw} USDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Draws</span>
              <span className="text-white">{pool.totalDraws}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Created</span>
              <span className="text-white">{new Date(pool.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-xl p-4 space-y-2">
          <div className="text-xs text-gray-500">Last One Prize</div>
          <div className="text-white text-sm font-medium">{pool.lastOnePrize.name}</div>
          <div className="text-gray-500 text-xs font-mono">Card #{pool.lastOnePrize.cardId}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <RefillSection poolId={pool.id} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin'] })} />
        <ResetSection
          poolId={pool.id}
          pendingDraws={pool.pendingDraws}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
        />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-pachinko-pink' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function RefillSection({ poolId, onSuccess }: { poolId: number; onSuccess: () => void }) {
  const [rows, setRows] = useState([{ cardId: '', rarity: 'common', count: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const { data: cardOptions } = useQuery<Array<{ id: number; name: string; rarity: string }>>({
    queryKey: ['admin', 'cards'],
    queryFn: async () => {
      const res = await fetch('/api/admin/cards', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  function addRow() {
    setRows([...rows, { cardId: '', rarity: 'common', count: '' }])
  }

  function updateRow(i: number, field: string, value: string) {
    const updated = [...rows]
    updated[i] = { ...updated[i]!, [field]: value }
    setRows(updated)
  }

  async function handleRefill() {
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/oripa/${poolId}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slotDistribution: rows.map((r) => ({
            cardId: parseInt(r.cardId, 10),
            rarity: r.rarity,
            count: parseInt(r.count, 10),
          })),
        }),
      })
      const data = (await res.json()) as { error?: string; added?: number; newTotal?: number }
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(`Added ${data.added} slots. New total: ${data.newTotal}`)
      onSuccess()
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const rarities = ['common', 'uncommon', 'rare', 'ultra_rare', 'secret_rare']

  return (
    <div className="bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-pachinko-blue">Refill Pool</div>
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-pachinko-blue hover:text-pachinko-blue/80"
        >
          + Row
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <select
              value={row.cardId}
              onChange={(e) => updateRow(i, 'cardId', e.target.value)}
              className="flex-1 bg-pachinko-bg border border-pachinko-gold/20 rounded px-1.5 py-1 text-white text-xs focus:outline-none"
            >
              <option value="">Card...</option>
              {cardOptions?.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.rarity}] {c.name}
                </option>
              ))}
            </select>
            <select
              value={row.rarity}
              onChange={(e) => updateRow(i, 'rarity', e.target.value)}
              className="w-28 bg-pachinko-bg border border-pachinko-gold/20 rounded px-1.5 py-1 text-white text-xs focus:outline-none"
            >
              {rarities.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={row.count}
              onChange={(e) => updateRow(i, 'count', e.target.value)}
              placeholder="#"
              className="w-16 bg-pachinko-bg border border-pachinko-gold/20 rounded px-1.5 py-1 text-white text-xs focus:outline-none"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleRefill}
        disabled={submitting}
        className="w-full py-2 bg-pachinko-blue/10 border border-pachinko-blue/30 rounded-lg text-pachinko-blue text-sm font-medium hover:bg-pachinko-blue/20 transition-all disabled:opacity-50"
      >
        {submitting ? 'Refilling...' : 'Refill'}
      </button>

      {result && (
        <div className="text-xs text-gray-400">{result}</div>
      )}
    </div>
  )
}

function ResetSection({
  poolId,
  pendingDraws,
  onSuccess,
}: {
  poolId: number
  pendingDraws: number
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleReset(force: boolean) {
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/oripa/${poolId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force }),
      })
      const data = (await res.json()) as { error?: string; pendingForceKept?: number }
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(
        `Reset complete. ${(data.pendingForceKept ?? 0) > 0 ? `${data.pendingForceKept} pending draws auto-kept.` : ''}`
      )
      setConfirmOpen(false)
      onSuccess()
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-xl p-4 space-y-3">
      <div className="text-sm font-medium text-red-400">Reset Pool</div>
      <p className="text-xs text-gray-500">
        Clears all pulls and re-shuffles card assignments. Draw history is preserved.
      </p>

      {pendingDraws > 0 && (
        <div className="bg-pachinko-pink/10 border border-pachinko-pink/30 rounded-lg p-2 text-xs text-pachinko-pink">
          {pendingDraws} pending draw(s). Reset will require force mode, which auto-keeps them without minting.
        </div>
      )}

      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
        >
          Reset Pool
        </button>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-red-400 font-medium">
            Are you sure? This cannot be undone.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleReset(pendingDraws > 0)}
              disabled={submitting}
              className="flex-1 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50"
            >
              {submitting ? 'Resetting...' : pendingDraws > 0 ? 'Force Reset' : 'Confirm Reset'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-lg text-gray-400 text-sm hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="text-xs text-gray-400">{result}</div>
      )}
    </div>
  )
}
