import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getPoolStatus } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/oripa/$id/pool')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          const id = parseInt(params.id)
          if (Number.isNaN(id) || id <= 0) return errorResponse('Invalid oripa ID', 400)

          const pool = await getPoolStatus(db, id)
          if (!pool) return errorResponse('Oripa not found', 404)
          return jsonResponse(pool)
        } catch (err) {
          console.error('Pool error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
