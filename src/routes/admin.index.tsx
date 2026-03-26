import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

interface OripaAdmin {
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
}

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const { data: pools, isLoading } = useQuery<OripaAdmin[]>({
    queryKey: ['admin', 'oripas'],
    queryFn: async () => {
      const res = await fetch('/api/admin/oripas', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="text-center text-pachinko-gold animate-pulse py-12">
        Loading pools...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-pachinko-gold">Pool Dashboard</h1>
        <Link
          to="/admin/create"
          className="py-2 px-4 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded-lg text-pachinko-gold text-sm font-semibold hover:bg-pachinko-gold/20 transition-all"
        >
          + Create Pool
        </Link>
      </div>

      {/* Stats Summary */}
      {pools && pools.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Pools"
            value={pools.length}
          />
          <StatCard
            label="Active"
            value={pools.filter((p) => p.status === 'active').length}
          />
          <StatCard
            label="Total Revenue"
            value={`$${pools.reduce((s, p) => s + p.revenue, 0).toFixed(2)}`}
          />
          <StatCard
            label="Total Draws"
            value={pools.reduce((s, p) => s + p.totalDraws, 0)}
          />
        </div>
      )}

      {/* Pool Table */}
      <div className="border border-pachinko-gold/20 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-pachinko-gold/5 text-pachinko-gold/70 text-left">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Slots</th>
              <th className="px-4 py-3 font-medium">Remaining</th>
              <th className="px-4 py-3 font-medium">Pending</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pachinko-gold/10">
            {pools?.map((pool) => (
              <tr
                key={pool.id}
                className="hover:bg-pachinko-gold/5 transition-colors"
              >
                <td className="px-4 py-3 text-gray-400 font-mono">#{pool.id}</td>
                <td className="px-4 py-3 text-white font-medium">{pool.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={pool.status} />
                </td>
                <td className="px-4 py-3 text-gray-300">${pool.pricePerDraw}</td>
                <td className="px-4 py-3 text-gray-300">{pool.totalSlots}</td>
                <td className="px-4 py-3 text-gray-300">
                  {pool.remaining}
                  <span className="text-gray-500 text-xs ml-1">
                    ({Math.round((pool.remaining / pool.totalSlots) * 100)}%)
                  </span>
                </td>
                <td className="px-4 py-3">
                  {pool.pendingDraws > 0 ? (
                    <span className="text-pachinko-pink">{pool.pendingDraws}</span>
                  ) : (
                    <span className="text-gray-500">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-pachinko-green font-mono">
                  ${pool.revenue.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to="/admin/pool/$id"
                    params={{ id: String(pool.id) }}
                    className="text-pachinko-blue hover:text-pachinko-blue/80 text-xs"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {(!pools || pools.length === 0) && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No pools created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-pachinko-gold/5 border border-pachinko-gold/20 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'active'
      ? 'bg-pachinko-green/10 text-pachinko-green border-pachinko-green/30'
      : 'bg-red-500/10 text-red-400 border-red-500/30'

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles}`}>
      {status}
    </span>
  )
}
