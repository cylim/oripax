import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useWallet } from './wallet'

interface AdminAuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  adminAddress: string | null
  login: () => Promise<void>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { address, connected, connect, signMessage } = useWallet()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [adminAddress, setAdminAddress] = useState<string | null>(null)

  // Check existing session on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/admin/oripas', { credentials: 'include' })
        if (!cancelled && res.ok) {
          setIsAuthenticated(true)
          setAdminAddress(address)
        }
      } catch {
        // Not authenticated
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [address])

  const login = useCallback(async () => {
    // Ensure wallet is connected
    if (!connected) {
      await connect()
    }

    const walletAddress = address
    if (!walletAddress) throw new Error('Wallet not connected')

    setIsLoading(true)
    try {
      // Step 1: Request challenge
      const challengeRes = await fetch('/api/admin/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      })

      if (!challengeRes.ok) {
        const err = (await challengeRes.json()) as { error?: string }
        throw new Error(err.error || 'Failed to get challenge')
      }

      const { message, nonce } = (await challengeRes.json()) as {
        message: string
        nonce: string
      }

      // Step 2: Sign with wallet
      const signature = await signMessage(message)

      // Step 3: Submit signature for JWT
      const loginRes = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: walletAddress, nonce, signature }),
      })

      if (!loginRes.ok) {
        const err = (await loginRes.json()) as { error?: string }
        throw new Error(err.error || 'Login failed')
      }

      setIsAuthenticated(true)
      setAdminAddress(walletAddress.toLowerCase())
    } finally {
      setIsLoading(false)
    }
  }, [address, connected, connect, signMessage])

  const logout = useCallback(() => {
    fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    setIsAuthenticated(false)
    setAdminAddress(null)
  }, [])

  return (
    <AdminAuthContext.Provider
      value={{ isAuthenticated, isLoading, adminAddress, login, logout }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
