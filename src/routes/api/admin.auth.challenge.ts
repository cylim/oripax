import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import { generateChallenge, isAdminAddress } from '~/server/admin-auth'
import { jsonResponse, errorResponse } from '~/server/response'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'

export const Route = createFileRoute('/api/admin/auth/challenge')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`admin-challenge:${getClientIp(request)}`, 10, 60_000)
        if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

        await initEnv()
        const env = getEnv()

        let body: { address?: string }
        try {
          body = await request.json()
        } catch {
          return errorResponse('Invalid JSON', 400)
        }

        const address = body.address
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
          return errorResponse('Invalid address', 400)
        }

        if (!isAdminAddress(address, env.ADMIN_WALLETS)) {
          return errorResponse('Not an admin address', 403)
        }

        const challenge = generateChallenge(address)
        return jsonResponse(challenge)
      },
    },
  },
})
