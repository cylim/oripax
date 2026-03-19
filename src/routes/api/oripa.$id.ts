import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { getOripaById } from '~/server/oripa.server'

export const Route = createFileRoute('/api/oripa/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
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
      },
    },
  },
})
