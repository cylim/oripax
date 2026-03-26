import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

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

export const Route = createFileRoute('/verify')({
  component: VerifyPage,
})

function VerifyPage() {
  const [drawId, setDrawId] = useState('')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/verify/${drawId}`)
      const data = (await res.json()) as VerifyResult | { error: string }
      if ('error' in data) throw new Error(data.error)
      setResult(data as VerifyResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-pachinko-gold neon-glow tracking-widest mb-2">
          PROVABLY FAIR
        </h1>
        <p className="text-white/50 text-sm">
          公正証明 — Verify any draw is fair
        </p>
      </div>

      {/* How it works */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 space-y-3">
        <h2 className="text-sm font-bold text-pachinko-gold">How it works</h2>
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
          {/* Verdict */}
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

          {/* Proof details */}
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
