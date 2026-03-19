import { getEnv } from './env'

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
        asset: 'USDT',
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

export async function verifyX402Payment(
  xPaymentHeader: string
): Promise<VerifiedPayment> {
  // Decode base64 X-PAYMENT header
  const decoded = atob(xPaymentHeader)
  const payment = JSON.parse(decoded) as {
    payerAddress: string
    amount: string
    txHash: string
    signature: string
  }

  // In production: verify via OKX Payment API or on-chain verification
  // For now, verify the payment tx exists on X Layer
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

  const result = (await rpcResponse.json()) as {
    result: { status: string } | null
  }

  if (!result.result || result.result.status !== '0x1') {
    throw new Error('Payment transaction not confirmed')
  }

  return {
    payerAddress: payment.payerAddress,
    amount: payment.amount,
    txHash: payment.txHash,
  }
}
