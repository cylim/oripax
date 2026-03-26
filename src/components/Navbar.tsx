import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { soundManager } from '~/lib/sounds'
import { useWallet } from '~/lib/wallet'
import { formatAddress } from '~/lib/utils'

export function Navbar() {
  const [muted, setMuted] = useState(() =>
    typeof window !== 'undefined' ? soundManager?.muted ?? false : false
  )
  const { address, connected, connecting, connect, disconnect } = useWallet()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-pachinko-bg/80">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-pachinko-gold neon-glow tracking-wider">
            OripaX
          </span>
          <span className="text-xs text-pachinko-pink opacity-70">オリパX</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-sm text-white/70 hover:text-pachinko-gold transition-colors"
            activeProps={{ className: 'text-sm text-pachinko-gold neon-glow' }}
          >
            Lobby
          </Link>
          <Link
            to="/cards"
            className="text-sm text-white/70 hover:text-pachinko-gold transition-colors"
            activeProps={{ className: 'text-sm text-pachinko-gold neon-glow' }}
          >
            Cards
          </Link>
          <Link
            to="/collection"
            className="text-sm text-white/70 hover:text-pachinko-gold transition-colors"
            activeProps={{ className: 'text-sm text-pachinko-gold neon-glow' }}
          >
            Collection
          </Link>
          <Link
            to="/leaderboard"
            className="text-sm text-white/70 hover:text-pachinko-gold transition-colors"
            activeProps={{ className: 'text-sm text-pachinko-gold neon-glow' }}
          >
            Leaderboard
          </Link>
          <Link
            to="/verify"
            className="text-sm text-white/70 hover:text-pachinko-gold transition-colors"
            activeProps={{ className: 'text-sm text-pachinko-gold neon-glow' }}
          >
            Fair
          </Link>

          <button
            onClick={() => {
              if (soundManager) {
                const newMuted = soundManager.toggleMute()
                setMuted(newMuted)
              }
            }}
            className="text-white/50 hover:text-white transition-colors text-lg"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>

          {connected ? (
            <div className="flex items-center gap-2">
              <span className="text-pachinko-gold text-sm font-mono">
                {formatAddress(address!)}
              </span>
              <button
                onClick={disconnect}
                className="px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm hover:bg-red-500/30 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="px-4 py-1.5 bg-pachinko-gold/20 border border-pachinko-gold/50 rounded text-pachinko-gold text-sm hover:bg-pachinko-gold/30 transition-colors disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
