import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { seedDatabase } from '~/server/seed'

export const Route = createFileRoute('/api/admin/seed')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = getEnv()

        // Auth check
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const db = getDb(env.DB)
        const result = await seedDatabase(db)

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
