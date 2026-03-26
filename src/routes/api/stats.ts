import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getGlobalStats } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          return jsonResponse(await getGlobalStats(db))
        } catch (err) {
          console.error('Stats error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
