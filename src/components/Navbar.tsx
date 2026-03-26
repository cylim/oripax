import { Link } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { soundManager } from '~/lib/sounds'
import { useWallet } from '~/lib/wallet'
import { formatAddress } from '~/lib/utils'

export function Navbar() {
  const [muted, setMuted] = useState(() =>
    typeof window !== 'undefined' ? soundManager?.muted ?? false : false
  )
  const { address, connected, connecting, connect, disconnect } = useWallet()
  const [walletOpen, setWalletOpen] = useState(false)
  const walletRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-pachinko-bg/80">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-pachinko-gold neon-glow tracking-wider">
            OripaX
          </span>
          <span className="text-xs text-pachinko-pink opacity-70">オリパX</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            to="/leaderboard"
            className="hidden sm:block text-sm text-white/70 hover:text-pachinko-gold transition-colors"
            activeProps={{ className: 'text-sm text-pachinko-gold neon-glow' }}
          >
            Leaderboard
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
            <div className="relative" ref={walletRef}>
              <button
                onClick={() => setWalletOpen((o) => !o)}
                className="px-4 py-1.5 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded text-pachinko-gold text-sm font-mono hover:bg-pachinko-gold/20 transition-colors"
              >
                {formatAddress(address!)}
              </button>
              {walletOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-pachinko-bg border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  <Link
                    to="/leaderboard"
                    onClick={() => setWalletOpen(false)}
                    className="block sm:hidden w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-pachinko-gold transition-colors"
                  >
                    Leaderboard
                  </Link>
                  <Link
                    to="/info"
                    search={{ tab: 'cards', drawId: '' }}
                    onClick={() => setWalletOpen(false)}
                    className="block w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-pachinko-gold transition-colors"
                  >
                    Cards
                  </Link>
                  <Link
                    to="/info"
                    search={{ tab: 'collection', drawId: '' }}
                    onClick={() => setWalletOpen(false)}
                    className="block w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-pachinko-gold transition-colors"
                  >
                    Collection
                  </Link>
                  <Link
                    to="/info"
                    search={{ tab: 'fair', drawId: '' }}
                    onClick={() => setWalletOpen(false)}
                    className="block w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 hover:text-pachinko-gold transition-colors"
                  >
                    Verify
                  </Link>
                  <div className="border-t border-white/10" />
                  <button
                    onClick={() => { disconnect(); setWalletOpen(false) }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
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
