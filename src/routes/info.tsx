import { createFileRoute, useSearch, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { OripaCard } from '~/components/OripaCard'
import { RARITY_ORDER, type RarityType } from '~/lib/constants'
import { useWallet } from '~/lib/wallet'
import { fetchUserDraws } from '~/server/oripa.functions'

// --- Types ---

interface CardData {
  id: number
  name: string
  rarity: string
  element: string
  imageUri: string
  setName: string
}

interface VerifyResult {
  drawId: number
  verified: boolean | null
  reason?: string
  proof?: {
    paymentTxHash: string
    serverSalt: string
    availableCount: number
    selectedIndex: number
    computedIndex: number
    hash: string
  }
  formula?: string
  card?: { cardId: number; rarity: string }
}

type Tab = 'cards' | 'collection' | 'fair'

// --- Route ---

export const Route = createFileRoute('/info')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as Tab) || 'cards',
    drawId: (search.drawId as string) || '',
  }),
  component: InfoPage,
})

// --- Page ---

function InfoPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const activeTab = search.tab || 'cards'

  function setTab(tab: Tab) {
    navigate({ to: '/info', search: { tab, drawId: search.drawId } })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cards', label: 'Cards' },
    { key: 'collection', label: 'Collection' },
    { key: 'fair', label: 'Fair' },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex justify-center gap-1 mb-8">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition-colors border-b-2 ${
              activeTab === t.key
                ? 'border-pachinko-gold text-pachinko-gold bg-pachinko-gold/10'
                : 'border-transparent text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'cards' && <CardsSection />}
      {activeTab === 'collection' && <CollectionSection />}
      {activeTab === 'fair' && <FairSection initialDrawId={search.drawId} />}
    </div>
  )
}

// --- Cards Section ---

const PAGE_SIZE = 16

function CardsSection() {
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
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-pachinko-gold neon-glow tracking-widest mb-1">
          CARD CATALOG
        </h2>
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

// --- Collection Section ---

function CollectionSection() {
  const [filterRarity, setFilterRarity] = useState<RarityType | 'all'>('all')
  const { address, connected } = useWallet()
  const navigate = useNavigate()

  const { data: draws = [], isLoading } = useQuery({
    queryKey: ['userDraws', address],
    queryFn: () => fetchUserDraws({ data: { address: address! } }),
    enabled: !!address,
  })

  const filteredDraws =
    filterRarity === 'all'
      ? draws
      : draws.filter((d) => d.card.rarity === filterRarity)

  function verifyDraw(drawId: number) {
    navigate({ to: '/info', search: { tab: 'fair', drawId: String(drawId) } })
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-pachinko-gold neon-glow tracking-widest mb-1">
          COLLECTION
        </h2>
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
          {filteredDraws.map((draw: any, i: number) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <OripaCard card={draw.card} size="md" />
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-white/30">#{draw.id}</span>
                <button
                  onClick={() => verifyDraw(draw.id)}
                  className="text-pachinko-blue/60 hover:text-pachinko-blue transition-colors"
                >
                  Verify
                </button>
                {draw.status === 'bought_back' && (
                  <span className="text-pachinko-pink">Sold back</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Fair Section ---

function FairSection({ initialDrawId }: { initialDrawId: string }) {
  const [drawId, setDrawId] = useState(initialDrawId || '')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialDrawId) {
      setDrawId(initialDrawId)
      handleVerifyId(initialDrawId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDrawId])

  async function handleVerifyId(id: string) {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/verify/${id}`)
      const data = (await res.json()) as VerifyResult | { error: string }
      if ('error' in data) throw new Error(data.error)
      setResult(data as VerifyResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    handleVerifyId(drawId)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-pachinko-gold neon-glow tracking-widest mb-1">
          PROVABLY FAIR
        </h2>
        <p className="text-white/50 text-sm">
          公正証明 — Verify any draw is fair
        </p>
      </div>

      {/* How it works */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 space-y-3">
        <h3 className="text-sm font-bold text-pachinko-gold">How it works</h3>
        <div className="text-xs text-white/60 space-y-2">
          <p>Every draw uses a provably fair algorithm. The slot selection is determined by:</p>
          <code className="block bg-black/30 rounded p-2 text-pachinko-blue font-mono text-[11px]">
            keccak256(paymentTxHash + serverSalt) % availableSlots = selectedIndex
          </code>
          <ul className="space-y-1 text-white/50">
            <li><span className="text-white/70">paymentTxHash</span> — your payment transaction hash (unpredictable by server)</li>
            <li><span className="text-white/70">serverSalt</span> — random 32 bytes generated before draw (unpredictable by user)</li>
            <li><span className="text-white/70">availableSlots</span> — number of remaining slots at draw time</li>
          </ul>
          <p>Neither side can manipulate the result: the server doesn't know your txHash before you pay, and you don't know the salt before the draw.</p>
        </div>
      </div>

      {/* Verify form */}
      <form onSubmit={handleVerify} className="flex gap-3 mb-6">
        <input
          type="number"
          min="1"
          value={drawId}
          onChange={(e) => setDrawId(e.target.value)}
          placeholder="Draw ID"
          required
          className="flex-1 bg-pachinko-bg border border-pachinko-gold/30 rounded-lg px-4 py-2 text-white text-sm placeholder-white/30 focus:border-pachinko-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded-lg text-pachinko-gold text-sm font-semibold hover:bg-pachinko-gold/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div
            className={`text-center p-4 rounded-xl border ${
              result.verified === null
                ? 'bg-white/5 border-white/20 text-white/50'
                : result.verified
                  ? 'bg-pachinko-green/10 border-pachinko-green/30 text-pachinko-green'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <div className="text-2xl font-bold mb-1">
              {result.verified === null
                ? 'N/A'
                : result.verified
                  ? 'VERIFIED FAIR'
                  : 'VERIFICATION FAILED'}
            </div>
            {result.reason && (
              <div className="text-xs">{result.reason}</div>
            )}
            {result.card && (
              <div className="text-xs mt-1">
                Card #{result.card.cardId} ({result.card.rarity})
              </div>
            )}
          </div>

          {result.proof && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white/70">Proof Details</h3>
              <div className="space-y-2 text-xs font-mono">
                <ProofRow label="Payment TxHash" value={result.proof.paymentTxHash} />
                <ProofRow label="Server Salt" value={result.proof.serverSalt} />
                <ProofRow label="keccak256 Hash" value={result.proof.hash} />
                <ProofRow label="Available Slots" value={String(result.proof.availableCount)} />
                <ProofRow label="Selected Index" value={String(result.proof.selectedIndex)} />
                <ProofRow label="Computed Index" value={String(result.proof.computedIndex)} />
              </div>
              {result.formula && (
                <div className="text-[10px] text-white/30 mt-2">{result.formula}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-white/40 text-[10px] uppercase">{label}</span>
      <span className="text-white/80 break-all">{value}</span>
    </div>
  )
}
