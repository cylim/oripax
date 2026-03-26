import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OripaCard } from '~/components/OripaCard'
import { RARITY_ORDER, type RarityType } from '~/lib/constants'

interface CardData {
  id: number
  name: string
  rarity: string
  element: string
  attack: number
  defense: number
  imageUri: string
  setName: string
}

export const Route = createFileRoute('/cards')({
  component: CardsPage,
})

const PAGE_SIZE = 16

function CardsPage() {
  const [filterRarity, setFilterRarity] = useState<RarityType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: cards = [], isLoading } = useQuery<CardData[]>({
    queryKey: ['cards'],
    queryFn: async () => {
      const res = await fetch('/api/cards')
      if (!res.ok) throw new Error('Failed to fetch cards')
      return res.json()
    },
  })

  const filtered = cards.filter((c) => {
    if (filterRarity !== 'all' && c.rarity !== filterRarity) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const currentPage = Math.min(page, totalPages || 1)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-pachinko-gold neon-glow tracking-widest mb-2">
          CARD CATALOG
        </h1>
        <p className="text-white/50 text-sm">
          カード一覧 — {cards.length} cards available
        </p>
      </div>

      {/* Search */}
      <div className="flex justify-center mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search cards..."
          className="w-full max-w-md bg-pachinko-bg border border-pachinko-gold/30 rounded-lg px-4 py-2 text-white text-sm placeholder-white/30 focus:border-pachinko-gold focus:outline-none"
        />
      </div>

      {/* Rarity filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <button
          onClick={() => { setFilterRarity('all'); setPage(1) }}
          className={`px-3 py-1 rounded text-xs transition-colors ${
            filterRarity === 'all'
              ? 'bg-pachinko-gold text-black'
              : 'bg-white/10 text-white/60 hover:bg-white/20'
          }`}
        >
          All ({cards.length})
        </button>
        {RARITY_ORDER.map((r) => {
          const count = cards.filter((c) => c.rarity === r).length
          if (count === 0) return null
          return (
            <button
              key={r}
              onClick={() => { setFilterRarity(r); setPage(1) }}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                filterRarity === r
                  ? 'bg-pachinko-gold text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {r.replace('_', ' ')} ({count})
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <p className="text-white/50 animate-pulse">Loading cards...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-white/50">No cards match your filter</p>
        </div>
      ) : (
        <>
          <p className="text-center text-white/30 text-xs mb-4">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} card{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center">
            {paged.map((card) => (
              <OripaCard key={card.id} card={card} size="md" />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white/10 rounded text-sm text-white/70 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, i, arr) => {
                  const prev = arr[i - 1]
                  const showEllipsis = prev !== undefined && p - prev > 1
                  return (
                    <span key={p} className="flex items-center gap-2">
                      {showEllipsis && <span className="text-white/30 text-sm">...</span>}
                      <button
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded text-sm transition-colors ${
                          p === currentPage
                            ? 'bg-pachinko-gold text-black font-bold'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white/10 rounded text-sm text-white/70 hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
