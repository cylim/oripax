import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { keepDraw, buybackDraw } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export const Route = createFileRoute('/api/draws/decide/$drawId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const ip = getClientIp(request)
          const rl = checkRateLimit(`decide:${ip}`, 30, 60_000)
          if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          const drawId = parseInt(params.drawId)
          if (Number.isNaN(drawId) || drawId <= 0) {
            return errorResponse('Invalid draw ID', 400)
          }

          const body = await request.json() as { action?: string; userAddress?: string }
          const { action, userAddress } = body

          if (!action || !['keep', 'buyback'].includes(action)) {
            return errorResponse('Invalid action, must be "keep" or "buyback"', 400)
          }
          if (!userAddress || !ADDRESS_RE.test(userAddress)) {
            return errorResponse('Invalid wallet address', 400)
          }

          if (action === 'keep') {
            const baseUrl = new URL(request.url).origin
            const result = await keepDraw(db, drawId, userAddress, baseUrl)
            return jsonResponse({
              success: true,
              action: 'kept',
              txHash: result.txHash,
              tokenId: result.tokenId,
              explorerUrl: result.explorerUrl,
              mintPending: result.mintPending,
            })
          }

          // buyback
          const result = await buybackDraw(db, drawId, userAddress)
          return jsonResponse({
            success: true,
            action: 'bought_back',
            refundAmount: result.refundAmount,
            refundTxHash: result.refundTxHash,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Internal server error'

          const clientErrors: Record<string, number> = {
            DRAW_NOT_FOUND: 404,
            NOT_OWNER: 403,
            ALREADY_DECIDED: 409,
            WINDOW_EXPIRED: 410,
            CANNOT_BUYBACK_LAST_ONE: 400,
            ORIPA_NOT_FOUND: 404,
          }

          const status = clientErrors[msg]
          if (status) return errorResponse(msg, status)

          console.error('Decide error:', err)
          return errorResponse('Internal server error', 500)
        }
      },
    },
  },
})
