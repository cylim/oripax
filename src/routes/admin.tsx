import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { AdminAuthProvider, useAdminAuth } from '~/lib/admin-auth'
import { useWallet } from '~/lib/wallet'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminGate />
    </AdminAuthProvider>
  )
}

function AdminGate() {
  const { isAuthenticated, isLoading, adminAddress, login, logout } = useAdminAuth()
  const { connected, connecting, connect } = useWallet()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-pachinko-gold text-xl animate-pulse">
          Verifying admin access...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-pachinko-bg border border-pachinko-gold/30 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <div className="text-3xl font-bold text-pachinko-gold neon-glow">
            ADMIN ACCESS
          </div>
          <p className="text-gray-400 text-sm">
            Connect your wallet and sign a message to authenticate as an admin.
          </p>

          {!connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full py-3 px-6 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded-xl text-pachinko-gold font-semibold hover:bg-pachinko-gold/20 transition-all disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <button
              onClick={login}
              className="w-full py-3 px-6 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded-xl text-pachinko-gold font-semibold hover:bg-pachinko-gold/20 transition-all"
            >
              Sign to Authenticate
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Admin Navbar */}
      <div className="border-b border-pachinko-gold/20 mb-6">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-6">
            <Link
              to="/admin"
              className="text-pachinko-gold font-bold text-lg neon-glow"
            >
              ADMIN
            </Link>
            <nav className="flex gap-4">
              <Link
                to="/admin"
                activeOptions={{ exact: true }}
                className="text-sm text-gray-400 hover:text-pachinko-gold transition-colors [&.active]:text-pachinko-gold"
              >
                Dashboard
              </Link>
              <Link
                to="/admin/create"
                className="text-sm text-gray-400 hover:text-pachinko-gold transition-colors [&.active]:text-pachinko-gold"
              >
                Create Pool
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 font-mono">
              {adminAddress?.slice(0, 6)}...{adminAddress?.slice(-4)}
            </span>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
