import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getOripaById } from '~/server/oripa.server'

export const Route = createFileRoute('/api/oripa/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          const oripa = await getOripaById(db, parseInt(params.id))

          if (!oripa) {
            return new Response(JSON.stringify({ error: 'Oripa not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          return new Response(JSON.stringify(oripa), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch oripa' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
