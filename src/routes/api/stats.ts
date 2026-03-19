import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { getGlobalStats } from '~/server/oripa.server'

export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = getEnv()
        const db = getDb(env.DB)
        const stats = await getGlobalStats(db)
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
