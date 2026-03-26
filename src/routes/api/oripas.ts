import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getActiveOripas } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/oripas')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          return jsonResponse(await getActiveOripas(db))
        } catch (err) {
          console.error('Oripas error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
