import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { seedDatabase } from '~/server/seed'

async function handleSeed(request: Request): Promise<Response> {
  await initEnv()
  const env = getEnv()

  // Auth check
  const authHeader = request.headers.get('Authorization')
  if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const db = getDb(env.DB)
    const result = await seedDatabase(db)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Seed failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export const Route = createFileRoute('/api/admin/seed')({
  server: {
    handlers: {
      GET: async ({ request }) => handleSeed(request),
      POST: async ({ request }) => handleSeed(request),
    },
  },
})
