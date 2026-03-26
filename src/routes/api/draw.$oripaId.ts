import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getOripaById, executeDraw, getPoolStatus, autoKeepExpiredDraws } from '~/server/oripa.server'
import { create402Response, verifyX402Payment } from '~/server/x402.server'
import { mintCardOnChain, mintLastOneOnChain } from '~/server/mint.server'
import { draws } from '~/server/schema'
import { eq } from 'drizzle-orm'
import { jsonResponse, errorResponse } from '~/server/response'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'
import { BUYBACK_WINDOW_MS } from '~/lib/constants'

export const Route = createFileRoute('/api/draw/$oripaId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          // Rate limit: 60 draw attempts per minute per IP
          const ip = getClientIp(request)
          const rl = checkRateLimit(`draw:${ip}`, 60, 60_000)
          if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          // Validate param (#12)
          const oripaId = parseInt(params.oripaId)
          if (Number.isNaN(oripaId) || oripaId <= 0) {
            return errorResponse('Invalid oripa ID', 400)
          }

          // 1. Check oripa exists and is active
          const oripa = await getOripaById(db, oripaId)
          if (!oripa) return errorResponse('Oripa not found', 404)
          if (oripa.status === 'sold_out') return errorResponse('Oripa is sold out', 410)

          // 2. Check for X-PAYMENT header
          const xPayment = request.headers.get('X-PAYMENT')
          if (!xPayment) {
            const pool = await getPoolStatus(db, oripaId)
            return create402Response(
              oripaId,
              oripa.pricePerDraw,
              pool?.remaining ?? 0,
              oripa.name
            )
          }

          // 3. Verify payment — checks on-chain receipt, amount, recipient, dedup
          let payment
          try {
            payment = await verifyX402Payment(xPayment, oripa.pricePerDraw, db)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment verification failed'
            return errorResponse(msg, 400)
          }

          // 4. Auto-keep any expired pending draws (lazy cleanup)
          const baseUrl = new URL(request.url).origin
          autoKeepExpiredDraws(db, baseUrl).catch(() => {}) // fire-and-forget

          // 5. Execute draw
          let drawResult
          try {
            drawResult = await executeDraw(db, oripaId, payment.payerAddress, payment.txHash)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Draw failed'
            if (message === 'SOLD_OUT') return errorResponse('Oripa is sold out', 410)
            return errorResponse('Draw failed, please retry', 500)
          }

          // 6. If Last One, mint immediately (no buyback allowed)
          let mintResult: { txHash: string | null; tokenId: number | null; explorerUrl: string | null } = {
            txHash: null, tokenId: null, explorerUrl: null,
          }
          let lastOnePrize = null

          if (drawResult.isLastOne) {
            // Mint the drawn card
            try {
              mintResult = await mintCardOnChain(
                payment.payerAddress,
                oripaId,
                drawResult.card.id,
                drawResult.card.rarity,
                baseUrl
              )
              if (mintResult.txHash) {
                await db.update(draws)
                  .set({ txHash: mintResult.txHash, mintedTokenId: mintResult.tokenId })
                  .where(eq(draws.id, drawResult.drawId))
              }
            } catch {
              // Mint failed but draw succeeded
            }

            // Mint Last One prize
            try {
              const lastOneMint = await mintLastOneOnChain(
                payment.payerAddress,
                oripaId,
                baseUrl
              )
              const prize = oripa.lastOnePrize
              lastOnePrize = {
                ...prize,
                rarity: 'last_one',
                txHash: lastOneMint.txHash,
                explorerUrl: lastOneMint.explorerUrl,
              }
            } catch {
              const prize = oripa.lastOnePrize
              lastOnePrize = { ...prize, rarity: 'last_one' }
            }
          }

          // Calculate decision deadline for pending draws
          const decisionDeadline = drawResult.isLastOne
            ? null
            : new Date(Date.now() + BUYBACK_WINDOW_MS).toISOString()

          return jsonResponse({
            success: true,
            drawId: drawResult.drawId,
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
            status: drawResult.isLastOne ? 'kept' : 'pending',
            decisionDeadline,
            buybackAmount: drawResult.isLastOne ? null : drawResult.buybackAmount,
            txHash: mintResult.txHash,
            explorerUrl: mintResult.explorerUrl,
            mintPending: drawResult.isLastOne ? !mintResult.txHash : true,
            proof: {
              paymentTxHash: payment.txHash,
              serverSalt: drawResult.proof.serverSalt,
              selectedIndex: drawResult.proof.selectedIndex,
              availableCount: drawResult.proof.availableCount,
            },
          })
        } catch (err) {
          console.error('Draw error:', err) // log internally only (#13)
          return errorResponse('Internal server error', 500)
        }
      },
    },
  },
})
