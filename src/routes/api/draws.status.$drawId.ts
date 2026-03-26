import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getDrawStatus } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export const Route = createFileRoute('/api/draws/status/$drawId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const ip = getClientIp(request)
          const rl = checkRateLimit(`draw-status:${ip}`, 60, 60_000)
          if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          const drawId = parseInt(params.drawId)
          if (Number.isNaN(drawId) || drawId <= 0) {
            return errorResponse('Invalid draw ID', 400)
          }

          const url = new URL(request.url)
          const address = url.searchParams.get('address')
          if (!address || !ADDRESS_RE.test(address)) {
            return errorResponse('Invalid or missing address parameter', 400)
          }

          const result = await getDrawStatus(db, drawId, address)
          if (!result) return errorResponse('Draw not found', 404)

          return jsonResponse(result)
        } catch (err) {
          console.error('Draw status error:', err)
          return errorResponse('Internal server error', 500)
        }
      },
    },
  },
})
