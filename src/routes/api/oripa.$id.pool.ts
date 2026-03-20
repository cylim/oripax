import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getPoolStatus } from '~/server/oripa.server'

export const Route = createFileRoute('/api/oripa/$id/pool')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
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
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch pool' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
