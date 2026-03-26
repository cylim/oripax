import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import {
  consumeChallenge,
  verifySignature,
  isAdminAddress,
  createJwt,
} from '~/server/admin-auth'
import { jsonResponseWithCookie, errorResponse } from '~/server/response'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'

export const Route = createFileRoute('/api/admin/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rl = checkRateLimit(`admin-login:${getClientIp(request)}`, 5, 60_000)
        if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

        await initEnv()
        const env = getEnv()

        let body: { address?: string; nonce?: string; signature?: string }
        try {
          body = await request.json()
        } catch {
          return errorResponse('Invalid JSON', 400)
        }

        const { address, nonce, signature } = body
        if (!address || !nonce || !signature) {
          return errorResponse('Missing address, nonce, or signature', 400)
        }

        // Consume the challenge (one-time use)
        const challenge = consumeChallenge(nonce, address)
        if (!challenge) {
          return errorResponse('Invalid or expired challenge', 401)
        }

        // Verify the signature recovers to the claimed address
        let recovered: string
        try {
          recovered = verifySignature(challenge.message, signature)
        } catch {
          return errorResponse('Invalid signature', 401)
        }

        if (recovered.toLowerCase() !== address.toLowerCase()) {
          return errorResponse('Signature does not match address', 401)
        }

        // Double-check admin status
        if (!isAdminAddress(address, env.ADMIN_WALLETS)) {
          return errorResponse('Not an admin address', 403)
        }

        // Issue JWT
        const token = await createJwt(address, env.JWT_SECRET)

        return jsonResponseWithCookie(
          { success: true, address: address.toLowerCase(), token },
          'admin_token',
          token,
          24 * 60 * 60 // 24h
        )
      },
    },
  },
})
