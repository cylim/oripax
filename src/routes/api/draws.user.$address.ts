import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { getUserDraws } from '~/server/oripa.server'

export const Route = createFileRoute('/api/draws/user/$address')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const env = getEnv()
        const db = getDb(env.DB)
        const draws = await getUserDraws(db, params.address)
        return new Response(JSON.stringify(draws), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
