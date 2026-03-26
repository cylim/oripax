import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getRecentDraws } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/draws/recent')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          return jsonResponse(await getRecentDraws(db, 20))
        } catch (err) {
          console.error('Recent draws error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
