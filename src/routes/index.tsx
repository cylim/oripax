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

      {/* Agent Integration Banner */}
      <div className="mt-12 bg-white/5 border border-pachinko-gold/20 rounded-xl p-5 sm:p-6 max-w-2xl mx-auto">
        <h2 className="text-sm font-bold text-pachinko-gold tracking-wider mb-3">
          AI AGENT INTEGRATION
        </h2>
        <p className="text-white/60 text-xs leading-relaxed mb-3">
          OripaX is designed for autonomous AI agents. Agents can browse pools, analyze odds, draw cards via x402 micropayments, and make keep/buyback decisions — all through a standard REST API with no API key required.
        </p>
        <div className="bg-black/30 rounded-lg p-3 mb-3 font-mono text-[11px] text-pachinko-blue overflow-x-auto">
          <span className="text-white/40">GET</span> /skills.md <span className="text-white/30">— full integration guide, API reference & agent workflow</span>
        </div>
        <p className="text-white/40 text-[10px]">
          Point your agent at{' '}
          <a
            href="/skills.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pachinko-gold/70 hover:text-pachinko-gold underline underline-offset-2 transition-colors"
          >
            /skills.md
          </a>
          {' '}to get started. It contains the full API reference, x402 payment flow, pool mechanics, error codes, and a recommended agent strategy.
        </p>
      </div>
    </div>
  )
}
