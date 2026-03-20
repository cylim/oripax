import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getRecentDraws } from '~/server/oripa.server'

export const Route = createFileRoute('/api/draws/recent')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          const draws = await getRecentDraws(db, 20)
          return new Response(JSON.stringify(draws), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch draws' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
