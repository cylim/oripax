import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { getRecentDraws } from '~/server/oripa.server'

export const Route = createFileRoute('/api/draws/recent')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = getEnv()
        const db = getDb(env.DB)
        const draws = await getRecentDraws(db, 20)
        return new Response(JSON.stringify(draws), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
