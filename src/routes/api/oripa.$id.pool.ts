import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { getPoolStatus } from '~/server/oripa.server'

export const Route = createFileRoute('/api/oripa/$id/pool')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const env = getEnv()
        const db = getDb(env.DB)
        const pool = await getPoolStatus(db, parseInt(params.id))

        if (!pool) {
          return new Response(JSON.stringify({ error: 'Oripa not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify(pool), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
