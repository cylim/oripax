import type { PaymentRequirements } from '~/server/x402.server'

export interface DrawResult {
  success: boolean
  card: {
    cardId: number
    rarity: string
    name: string
    imageUri: string
    element: string
    attack: number
    defense: number
  }
  isLastOne: boolean
  lastOnePrize: {
    cardId: number
    name: string
    rarity: string
    imageUri: string
  } | null
  remainingSlots: number
  totalSlots: number
  txHash: string
  explorerUrl: string
}

export async function handleX402Draw(
  oripaId: number,
  signPayment: (requirements: PaymentRequirements) => Promise<string>
): Promise<DrawResult> {
  // Step 1: Request draw, expect 402
  const initialResponse = await fetch(`/api/draw/${oripaId}`)

  if (initialResponse.status === 402) {
    const requirements: PaymentRequirements = await initialResponse.json()

    // Step 2: Sign payment via wallet
    const paymentPayload = await signPayment(requirements)
    const xPayment = btoa(paymentPayload)

    // Step 3: Retry with X-PAYMENT header
    const drawResponse = await fetch(`/api/draw/${oripaId}`, {
      headers: {
        'X-PAYMENT': xPayment,
      },
    })

    if (!drawResponse.ok) {
      const error = await drawResponse.json() as { error: string }
      throw new Error(error.error || 'Draw failed')
    }

    return drawResponse.json() as Promise<DrawResult>
  }

  if (!initialResponse.ok) {
    const error = await initialResponse.json() as { error: string }
    throw new Error(error.error || 'Draw failed')
  }

  return initialResponse.json() as Promise<DrawResult>
}
