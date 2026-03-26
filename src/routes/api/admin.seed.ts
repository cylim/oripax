import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { seedDatabase } from '~/server/seed'
import { jsonResponse, errorResponse } from '~/server/response'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'

async function handleSeed(request: Request): Promise<Response> {
  // Rate limit: 3 seed attempts per minute per IP
  const rl = checkRateLimit(`seed:${getClientIp(request)}`, 3, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

  await initEnv()
  const env = getEnv()

  // Auth check — require ADMIN_SECRET to be configured (#4, #5)
  if (!env.ADMIN_SECRET) {
    return errorResponse('Admin endpoint not configured', 403)
  }
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const db = getDb(env.DB)
    const result = await seedDatabase(db)
    return jsonResponse(result)
  } catch (err) {
    console.error('Seed error:', err)
    return errorResponse('Seed failed', 500)
  }
}

export const Route = createFileRoute('/api/admin/seed')({
  server: {
    handlers: {
      GET: async ({ request }) => handleSeed(request),
      POST: async ({ request }) => handleSeed(request),
    },
  },
})
