import { ethers } from 'ethers'
import { getEnv } from './env'

/**
 * Workers-compatible JSON-RPC provider using native fetch.
 * ethers.JsonRpcProvider uses Node.js https module which doesn't work in Workers/miniflare.
 */
class FetchJsonRpcProvider extends ethers.JsonRpcApiProvider {
  private rpcUrl: string

  constructor(rpcUrl: string) {
    super(new ethers.Network('xlayer', 196), { staticNetwork: true })
    this.rpcUrl = rpcUrl
  }

  async _send(
    payload: ethers.JsonRpcPayload | ethers.JsonRpcPayload[]
  ): Promise<ethers.JsonRpcResult[]> {
    const payloads = Array.isArray(payload) ? payload : [payload]

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
    })

    const result = await response.json()
    return Array.isArray(result) ? result : [result]
  }
}

export function getProvider(): ethers.JsonRpcApiProvider {
  const env = getEnv()
  return new FetchJsonRpcProvider(env.XLAYER_RPC)
}

export function getMinterWallet(): ethers.Wallet {
  const env = getEnv()
  return new ethers.Wallet(env.MINTER_PRIVATE_KEY, getProvider())
}
