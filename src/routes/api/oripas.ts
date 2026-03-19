import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { getActiveOripas } from '~/server/oripa.server'

export const Route = createFileRoute('/api/oripas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = getEnv()
        const db = getDb(env.DB)
        const oripas = await getActiveOripas(db)
        return new Response(JSON.stringify(oripas), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
