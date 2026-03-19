import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OripaCard } from '~/components/OripaCard'
import { RARITY_ORDER, type RarityType } from '~/lib/constants'
import { useWallet } from '~/lib/wallet'
import { fetchUserDraws } from '~/server/oripa.functions'

export const Route = createFileRoute('/collection')({
  component: CollectionPage,
})

function CollectionPage() {
  const [filterRarity, setFilterRarity] = useState<RarityType | 'all'>('all')
  const { address, connected } = useWallet()

  const { data: draws = [], isLoading } = useQuery({
    queryKey: ['userDraws', address],
    queryFn: () => fetchUserDraws({ data: { address: address! } }),
    enabled: !!address,
  })

  const filteredDraws =
    filterRarity === 'all'
      ? draws
      : draws.filter((d) => d.card.rarity === filterRarity)

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-pachinko-gold neon-glow tracking-widest mb-2">
          COLLECTION
        </h1>
        <p className="text-white/50 text-sm">コレクション — Your drawn cards</p>
      </div>

      {/* Rarity filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <button
          onClick={() => setFilterRarity('all')}
          className={`px-3 py-1 rounded text-xs transition-colors ${
            filterRarity === 'all'
              ? 'bg-pachinko-gold text-black'
              : 'bg-white/10 text-white/60 hover:bg-white/20'
          }`}
        >
          All
        </button>
        {RARITY_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => setFilterRarity(r)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              filterRarity === r
                ? 'bg-pachinko-gold text-black'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {r.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <p className="text-white/50">Loading your collection...</p>
        </div>
      ) : !connected ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔗</div>
          <p className="text-white/50 mb-2">Connect your wallet</p>
          <p className="text-white/30 text-sm">
            Connect your OKX wallet to view your collection
          </p>
        </div>
      ) : filteredDraws.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🃏</div>
          <p className="text-white/50 mb-2">No cards yet</p>
          <p className="text-white/30 text-sm">
            Head to the lobby and draw your first card!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 justify-items-center">
          {filteredDraws.map((draw, i) => (
            <OripaCard key={i} card={draw.card} size="md" />
          ))}
        </div>
      )}
    </div>
  )
}
