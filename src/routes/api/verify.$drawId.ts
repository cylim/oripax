import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { draws } from '~/server/schema'
import { eq } from 'drizzle-orm'
import { ethers } from 'ethers'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/verify/$drawId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          const drawId = parseInt(params.drawId, 10)
          if (isNaN(drawId)) return errorResponse('Invalid draw ID', 400)

          const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
          if (!draw) return errorResponse('Draw not found', 404)

          if (!draw.serverSalt || !draw.paymentTxHash || draw.selectedIndex == null || draw.availableCount == null) {
            return jsonResponse({
              drawId: draw.id,
              verified: null,
              reason: 'Draw was created before provably fair system was enabled',
            })
          }

          // Recompute: keccak256(txHash + serverSalt) % availableCount
          const hash = ethers.keccak256(
            ethers.concat([ethers.getBytes(draw.paymentTxHash), ethers.getBytes(draw.serverSalt)])
          )
          const computedIndex = Number(BigInt(hash) % BigInt(draw.availableCount))
          const verified = computedIndex === draw.selectedIndex

          return jsonResponse({
            drawId: draw.id,
            verified,
            proof: {
              paymentTxHash: draw.paymentTxHash,
              serverSalt: draw.serverSalt,
              availableCount: draw.availableCount,
              selectedIndex: draw.selectedIndex,
              computedIndex,
              hash,
            },
            formula: `keccak256(paymentTxHash + serverSalt) % availableCount = selectedIndex`,
            card: {
              cardId: draw.cardId,
              rarity: draw.rarity,
            },
          })
        } catch (err) {
          console.error('Verify error:', err)
          return errorResponse('Internal server error', 500)
        }
      },
    },
  },
})
