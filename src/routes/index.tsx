import { createFileRoute } from '@tanstack/react-router'
import { VendingMachine } from '~/components/VendingMachine'
import { fetchActiveOripas } from '~/server/oripa.functions'

export const Route = createFileRoute('/')({
  loader: () => fetchActiveOripas(),
  component: LobbyPage,
})

function LobbyPage() {
  const oripas = Route.useLoaderData()

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-pachinko-gold neon-glow tracking-widest mb-2">
          ORIPA LOBBY
        </h1>
        <p className="text-white/50 text-sm">
          オリパロビー — Pick a machine, draw your fate
        </p>
      </div>

      {oripas.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎰</div>
          <p className="text-white/50">No active oripas. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {oripas.map((oripa) => (
            <VendingMachine key={oripa.id} oripa={oripa} />
          ))}
        </div>
      )}
    </div>
  )
}
