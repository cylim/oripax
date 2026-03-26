import { eq } from 'drizzle-orm'
import { getEnv } from './env'
import { draws } from './schema'
import { USDC_CONTRACT_ADDRESS } from '~/lib/constants'
import type { Database } from './db'

export interface PaymentRequirements {
  type: 'x402'
  version: '1.0'
  accepts: Array<{
    scheme: 'exact'
    price: string
    network: string
    asset: string
    payTo: string
  }>
  description: string
}

export function create402Response(
  oripaId: number,
  price: number,
  remaining: number,
  name: string
): Response {
  const env = getEnv()
  const requirements: PaymentRequirements = {
    type: 'x402',
    version: '1.0',
    accepts: [
      {
        scheme: 'exact',
        price: `$${price.toFixed(2)}`,
        network: 'eip155:196',
        asset: 'USDC',
        payTo: env.PAYMENT_WALLET,
      },
    ],
    description: `Draw from ${name} (${remaining} remaining)`,
  }

  return new Response(JSON.stringify(requirements), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
    },
  })
}

export interface VerifiedPayment {
  payerAddress: string
  amount: string
  txHash: string
}

// ERC-20 Transfer(address,address,uint256) event topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7814a90d3ea3e44252318287461'

interface RpcReceiptLog {
  address: string
  topics: string[]
  data: string
}

interface RpcReceipt {
  status: string
  logs: RpcReceiptLog[]
}

export async function verifyX402Payment(
  xPaymentHeader: string,
  expectedPrice: number,
  db: Database
): Promise<VerifiedPayment> {
  // Decode base64 X-PAYMENT header
  const decoded = atob(xPaymentHeader)
  let payment: { txHash: string }
  try {
    payment = JSON.parse(decoded) as { txHash: string }
  } catch {
    throw new Error('Invalid payment payload')
  }

  if (!payment.txHash || typeof payment.txHash !== 'string') {
    throw new Error('Missing transaction hash')
  }

  // Check for payment replay — txHash must not have been used before
  const existing = await db
    .select({ id: draws.id })
    .from(draws)
    .where(eq(draws.paymentTxHash, payment.txHash))
    .limit(1)
  if (existing.length > 0) {
    throw new Error('Payment already used')
  }

  // Fetch transaction receipt from X Layer RPC
  const env = getEnv()
  const rpcResponse = await fetch(env.XLAYER_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [payment.txHash],
      id: 1,
    }),
  })

  const rpcResult = (await rpcResponse.json()) as { result: RpcReceipt | null }
  const receipt = rpcResult.result

  if (!receipt || receipt.status !== '0x1') {
    throw new Error('Payment transaction not confirmed')
  }

  // Find the ERC-20 Transfer event log matching our USDC contract and payment wallet
  const usdtAddress = USDC_CONTRACT_ADDRESS.toLowerCase()
  const paymentWallet = env.PAYMENT_WALLET.toLowerCase()

  const transferLog = receipt.logs.find((log) => {
    if (log.address.toLowerCase() !== usdtAddress) return false
    if (log.topics[0] !== TRANSFER_TOPIC) return false
    if (!log.topics[2]) return false
    // topics[2] is the `to` address, zero-padded to 32 bytes
    const toAddress = '0x' + log.topics[2].slice(26)
    return toAddress.toLowerCase() === paymentWallet
  })

  if (!transferLog) {
    throw new Error('No valid USDC transfer to payment wallet found')
  }

  // Verify the transfer amount (USDC has 6 decimals)
  const actualAmount = BigInt(transferLog.data)
  const expectedAmount = BigInt(Math.round(expectedPrice * 1e6))
  if (actualAmount < expectedAmount) {
    throw new Error('Insufficient payment amount')
  }

  // Extract the real payer address from the Transfer event (not from user-supplied JSON)
  const payerAddress = '0x' + transferLog.topics[1]!.slice(26)

  return {
    payerAddress: payerAddress.toLowerCase(),
    amount: (Number(actualAmount) / 1e6).toFixed(2),
    txHash: payment.txHash,
  }
}
