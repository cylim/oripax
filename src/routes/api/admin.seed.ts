import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { seedStatus } from '~/server/seed'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/admin/seed')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await initEnv()
        const env = getEnv()

        if (!env.ADMIN_SECRET) return errorResponse('Admin endpoint not configured', 403)
        const authHeader = request.headers.get('Authorization')
        if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) return errorResponse('Unauthorized', 401)

        try {
          const db = getDb(env.DB)
          return jsonResponse(await seedStatus(db))
        } catch (err) {
          console.error('Seed status error:', err)
          return errorResponse('Failed to check seed status', 500)
        }
      },
    },
  },
})
