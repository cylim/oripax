import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getOripaById } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/oripa/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          const id = parseInt(params.id)
          if (Number.isNaN(id) || id <= 0) return errorResponse('Invalid oripa ID', 400)

          const oripa = await getOripaById(db, id)
          if (!oripa) return errorResponse('Oripa not found', 404)
          return jsonResponse(oripa)
        } catch (err) {
          console.error('Oripa detail error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
