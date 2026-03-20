import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getOripaById, executeDraw, getPoolStatus } from '~/server/oripa.server'
import { create402Response, verifyX402Payment } from '~/server/x402.server'
import { mintCardOnChain, mintLastOneOnChain } from '~/server/mint.server'
import { XLAYER_EXPLORER } from '~/lib/constants'

export const Route = createFileRoute('/api/draw/$oripaId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
        await initEnv()
        const env = getEnv()
        const db = getDb(env.DB)
        const oripaId = parseInt(params.oripaId)

        // 1. Check oripa exists and is active
        const oripa = await getOripaById(db, oripaId)
        if (!oripa) {
          return new Response(JSON.stringify({ error: 'Oripa not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (oripa.status === 'sold_out') {
          return new Response(JSON.stringify({ error: 'Oripa is sold out' }), {
            status: 410,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // 2. Check for X-PAYMENT header
        const xPayment = request.headers.get('X-PAYMENT')
        if (!xPayment) {
          // Return 402 with payment requirements
          const pool = await getPoolStatus(db, oripaId)
          return create402Response(
            oripaId,
            oripa.pricePerDraw,
            pool?.remaining ?? 0,
            oripa.name
          )
        }

        // 3. Verify payment
        let payment
        try {
          payment = await verifyX402Payment(xPayment)
        } catch {
          return new Response(
            JSON.stringify({ error: 'Payment verification failed' }),
            { status: 402, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // 4. Execute draw
        let drawResult
        try {
          drawResult = await executeDraw(db, oripaId, payment.payerAddress)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Draw failed'
          if (message === 'SOLD_OUT') {
            return new Response(
              JSON.stringify({ error: 'Oripa is sold out' }),
              { status: 410, headers: { 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ error: 'Draw failed, please retry' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // 5. Mint NFT on-chain
        const baseUrl = new URL(request.url).origin
        let mintResult
        try {
          mintResult = await mintCardOnChain(
            payment.payerAddress,
            oripaId,
            drawResult.card.id,
            drawResult.card.rarity,
            baseUrl
          )
        } catch {
          // Mint failed but draw succeeded — return draw result with no txHash
          mintResult = { txHash: null, tokenId: null, explorerUrl: null }
        }

        // 6. If Last One, also mint the Last One prize
        let lastOnePrize = null
        if (drawResult.isLastOne) {
          try {
            const lastOneMint = await mintLastOneOnChain(
              payment.payerAddress,
              oripaId,
              baseUrl
            )
            lastOnePrize = {
              ...oripa.lastOnePrize,
              rarity: 'last_one',
              txHash: lastOneMint.txHash,
              explorerUrl: lastOneMint.explorerUrl,
            }
          } catch {
            lastOnePrize = { ...oripa.lastOnePrize, rarity: 'last_one' }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            card: {
              cardId: drawResult.card.id,
              rarity: drawResult.card.rarity,
              name: drawResult.card.name,
              imageUri: drawResult.card.imageUri,
              element: drawResult.card.element,
              attack: drawResult.card.attack,
              defense: drawResult.card.defense,
            },
            isLastOne: drawResult.isLastOne,
            lastOnePrize,
            remainingSlots: drawResult.remaining,
            totalSlots: oripa.totalSlots,
            txHash: mintResult.txHash,
            explorerUrl: mintResult.explorerUrl,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
