import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface CardOption {
  id: number
  name: string
  rarity: string
  element: string
  imageUri: string
}

interface SlotRow {
  cardId: string
  rarity: string
  count: string
}

export const Route = createFileRoute('/admin/create')({
  component: CreatePoolPage,
})

function CreatePoolPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pricePerDraw, setPricePerDraw] = useState('0.01')
  const [totalSlots, setTotalSlots] = useState('100')
  const [lastOneCardId, setLastOneCardId] = useState('')
  const [rows, setRows] = useState<SlotRow[]>([{ cardId: '', rarity: 'common', count: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: cardOptions } = useQuery<CardOption[]>({
    queryKey: ['admin', 'cards'],
    queryFn: async () => {
      const res = await fetch('/api/admin/cards', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch cards')
      return res.json()
    },
  })

  const distributedTotal = rows.reduce((s, r) => s + (parseInt(r.count, 10) || 0), 0)
  const slotsNum = parseInt(totalSlots, 10) || 0

  function addRow() {
    setRows([...rows, { cardId: '', rarity: 'common', count: '' }])
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: keyof SlotRow, value: string) {
    const updated = [...rows]
    updated[index] = { ...updated[index]!, [field]: value }
    setRows(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const lastOneCard = cardOptions?.find((c) => c.id === parseInt(lastOneCardId, 10))
    if (!lastOneCard) {
      setError('Please select a Last One prize card')
      return
    }

    if (distributedTotal !== slotsNum) {
      setError(`Slot distribution (${distributedTotal}) must equal total slots (${slotsNum})`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/oripa/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          totalSlots: slotsNum,
          pricePerDraw: parseFloat(pricePerDraw),
          lastOnePrize: {
            cardId: lastOneCard.id,
            name: lastOneCard.name,
            imageUri: lastOneCard.imageUri,
          },
          slotDistribution: rows.map((r) => ({
            cardId: parseInt(r.cardId, 10),
            rarity: r.rarity,
            count: parseInt(r.count, 10),
          })),
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to create pool')
      }

      const { oripa } = (await res.json()) as { oripa: { id: number } }
      navigate({ to: '/admin/pool/$id', params: { id: String(oripa.id) } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const rarities = ['common', 'uncommon', 'rare', 'ultra_rare', 'secret_rare']

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-pachinko-gold">Create Pool</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3">
            <label className="block text-xs text-gray-500 mb-1">Pool Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-pachinko-bg border border-pachinko-gold/30 rounded-lg px-3 py-2 text-white focus:border-pachinko-gold focus:outline-none"
              placeholder="e.g. Premium Collection"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Price per Draw (USDC)</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={pricePerDraw}
              onChange={(e) => setPricePerDraw(e.target.value)}
              required
              className="w-full bg-pachinko-bg border border-pachinko-gold/30 rounded-lg px-3 py-2 text-white focus:border-pachinko-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Total Slots</label>
            <input
              type="number"
              min="1"
              value={totalSlots}
              onChange={(e) => setTotalSlots(e.target.value)}
              required
              className="w-full bg-pachinko-bg border border-pachinko-gold/30 rounded-lg px-3 py-2 text-white focus:border-pachinko-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Last One Prize Card</label>
            <select
              value={lastOneCardId}
              onChange={(e) => setLastOneCardId(e.target.value)}
              required
              className="w-full bg-pachinko-bg border border-pachinko-gold/30 rounded-lg px-3 py-2 text-white focus:border-pachinko-gold focus:outline-none"
            >
              <option value="">Select card...</option>
              {cardOptions
                ?.filter((c) => ['secret_rare', 'ultra_rare', 'rare'].includes(c.rarity))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.rarity}] {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Slot Distribution */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">
              Slot Distribution{' '}
              <span
                className={
                  distributedTotal === slotsNum
                    ? 'text-pachinko-green'
                    : 'text-pachinko-pink'
                }
              >
                ({distributedTotal}/{slotsNum})
              </span>
            </label>
            <button
              type="button"
              onClick={addRow}
              className="text-xs text-pachinko-blue hover:text-pachinko-blue/80"
            >
              + Add Row
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={row.cardId}
                  onChange={(e) => updateRow(i, 'cardId', e.target.value)}
                  required
                  className="flex-1 bg-pachinko-bg border border-pachinko-gold/20 rounded-lg px-2 py-1.5 text-white text-sm focus:border-pachinko-gold focus:outline-none"
                >
                  <option value="">Select card...</option>
                  {cardOptions?.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.rarity}] {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={row.rarity}
                  onChange={(e) => updateRow(i, 'rarity', e.target.value)}
                  className="w-36 bg-pachinko-bg border border-pachinko-gold/20 rounded-lg px-2 py-1.5 text-white text-sm focus:border-pachinko-gold focus:outline-none"
                >
                  {rarities.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={row.count}
                  onChange={(e) => updateRow(i, 'count', e.target.value)}
                  required
                  placeholder="Count"
                  className="w-24 bg-pachinko-bg border border-pachinko-gold/20 rounded-lg px-2 py-1.5 text-white text-sm focus:border-pachinko-gold focus:outline-none"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-red-400 hover:text-red-300 text-sm px-1"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || distributedTotal !== slotsNum}
          className="w-full py-3 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded-xl text-pachinko-gold font-semibold hover:bg-pachinko-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create Pool'}
        </button>
      </form>
    </div>
  )
}
