import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchGlobalStats, fetchRecentDraws } from '~/server/oripa.functions'
import { formatAddress } from '~/lib/utils'
import { RARITY_COLORS, type RarityType } from '~/lib/constants'

export const Route = createFileRoute('/leaderboard')({
  loader: async () => {
    const [stats, draws] = await Promise.all([
      fetchGlobalStats(),
      fetchRecentDraws(),
    ])
    return { stats, draws }
  },
  component: LeaderboardPage,
})

function LeaderboardPage() {
  const { stats: initialStats, draws: initialDraws } = Route.useLoaderData()

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => fetchGlobalStats(),
    initialData: initialStats,
    refetchInterval: 10000,
  })

  const { data: draws } = useQuery({
    queryKey: ['recentDraws'],
    queryFn: () => fetchRecentDraws(),
    initialData: initialDraws,
    refetchInterval: 5000,
  })

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-pachinko-gold neon-glow tracking-widest mb-2">
          LEADERBOARD
        </h1>
        <p className="text-white/50 text-sm">ランキング — Hall of Champions</p>
      </div>

      {/* Global stats banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-pachinko-gold">{stats.totalDraws}</div>
          <div className="text-xs text-white/50 mt-1">Total Draws</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-pachinko-pink">{stats.totalLastOneWins}</div>
          <div className="text-xs text-white/50 mt-1">Last One Winners</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center col-span-2 md:col-span-1">
          <div className="text-3xl font-bold text-pachinko-blue">{draws.length}</div>
          <div className="text-xs text-white/50 mt-1">Recent Pulls</div>
        </div>
      </div>

      {/* Last One Winners */}
      {stats.lastOneWinners.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-pachinko-gold mb-4">
            🏆 ラストワン Champions
          </h2>
          <div className="space-y-2">
            {stats.lastOneWinners.map((winner, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-gradient-to-r from-pachinko-gold/10 to-transparent border border-pachinko-gold/20 rounded-lg px-4 py-3"
              >
                <span className="text-pachinko-gold font-bold">#{i + 1}</span>
                <span className="font-mono text-white/80">
                  {formatAddress(winner.address)}
                </span>
                <span className="text-xs text-white/40 ml-auto">
                  Oripa #{winner.oripaId}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Draws */}
      <div>
        <h2 className="text-lg font-bold text-white/80 mb-4">
          Recent Pulls
        </h2>
        {draws.length === 0 ? (
          <p className="text-white/40 text-center py-8">No draws yet</p>
        ) : (
          <div className="space-y-2">
            {draws.map((draw: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-3"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      RARITY_COLORS[draw.card?.rarity as RarityType] || '#A0A0A0',
                  }}
                />
                <span className="text-sm text-white/80 truncate flex-1">
                  {draw.card?.name || 'Unknown Card'}
                </span>
                <span className="font-mono text-xs text-white/40">
                  {formatAddress(draw.userAddress)}
                </span>
                {draw.isLastOne && (
                  <span className="text-xs text-pachinko-pink font-bold">LAST ONE!</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
