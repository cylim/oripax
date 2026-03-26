import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { PaymentRequirements } from '~/server/x402.server'
import { USDC_CONTRACT_ADDRESS } from './constants'

// Lazy-import OKX SDK types
type OKXUniversalConnectUIType = import('@okxconnect/ui').OKXUniversalConnectUI

// Module-level singleton (SSR-safe)
let uiInstance: OKXUniversalConnectUIType | null = null
let uiInitPromise: Promise<OKXUniversalConnectUIType> | null = null

async function getUI(): Promise<OKXUniversalConnectUIType> {
  if (uiInstance) return uiInstance
  if (uiInitPromise) return uiInitPromise

  uiInitPromise = (async () => {
    const { OKXUniversalConnectUI, THEME } = await import('@okxconnect/ui')
    const instance = await OKXUniversalConnectUI.init({
      dappMetaData: {
        name: 'OripaX',
        icon: 'https://raw.githubusercontent.com/nicnocquee/okx-icon/main/okx.png',
      },
      uiPreferences: {
        theme: THEME.DARK,
      },
      actionsConfiguration: {
        modals: 'all',
      },
      language: 'en_US',
    })
    uiInstance = instance
    return instance
  })()

  return uiInitPromise
}

interface WalletContextValue {
  address: string | null
  connected: boolean
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  signPayment: (requirements: PaymentRequirements) => Promise<string>
  signMessage: (message: string) => Promise<string>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Restore session on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    ;(async () => {
      try {
        const ui = await getUI()
        if (cancelled) return

        // Check existing session
        const session = ui.session
        if (session?.namespaces?.eip155?.accounts?.[0]) {
          const account = session.namespaces.eip155.accounts[0]
          // Format: eip155:196:0xAddr
          const addr = account.split(':')[2]
          if (addr) setAddress(addr)
        }

        // Listen for disconnection
        ui.on('session_delete', () => {
          setAddress(null)
        })
      } catch {
        // SDK init failed silently on mount
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return
    setConnecting(true)
    try {
      const ui = await getUI()
      const session = await ui.openModal({
        namespaces: {
          eip155: {
            chains: ['eip155:196'],
            rpcMap: {
              '196': 'https://rpc.xlayer.tech',
            },
            defaultChain: '196',
          },
        },
      })

      if (session?.namespaces?.eip155?.accounts?.[0]) {
        const account = session.namespaces.eip155.accounts[0]
        const addr = account.split(':')[2]
        if (addr) setAddress(addr)
      }
    } catch {
      // User cancelled or error
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      const ui = await getUI()
      await ui.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    setAddress(null)
  }, [])

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      const ui = await getUI()
      if (!address) throw new Error('Wallet not connected')
      // Hex-encode message for personal_sign
      const hex =
        '0x' +
        Array.from(new TextEncoder().encode(message))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      return ui.request<string>(
        { method: 'personal_sign', params: [hex, address] },
        'eip155:196'
      )
    },
    [address]
  )

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<string> => {
      const ui = await getUI()
      const accept = requirements.accepts[0]
      if (!accept) throw new Error('No payment method available')

      // Parse price: "$0.10" → 0.10 → 100000 (6 decimals for USDC)
      const priceStr = accept.price.replace('$', '')
      const priceNum = parseFloat(priceStr)
      const amount = BigInt(Math.round(priceNum * 1e6))

      // Build ERC-20 transfer(address,uint256) calldata
      // Function selector: 0xa9059cbb
      const to = accept.payTo.toLowerCase().replace('0x', '').padStart(64, '0')
      const value = amount.toString(16).padStart(64, '0')
      const data = `0xa9059cbb${to}${value}`

      const currentAddress = address
      if (!currentAddress) throw new Error('Wallet not connected')

      // Send ERC-20 transfer via wallet
      const txHash = await ui.request<string>(
        {
          method: 'eth_sendTransaction',
          params: [
            {
              from: currentAddress,
              to: USDC_CONTRACT_ADDRESS,
              data,
              value: '0x0',
            },
          ],
        },
        'eip155:196'
      )

      console.log('[wallet] Payment tx sent:', txHash)

      return JSON.stringify({
        payerAddress: currentAddress,
        amount: priceStr,
        txHash,
        signature: txHash,
      })
    },
    [address]
  )

  return (
    <WalletContext.Provider
      value={{
        address,
        connected: !!address,
        connecting,
        connect,
        disconnect,
        signPayment,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
