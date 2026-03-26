import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import { getDb } from '~/server/db'
import { requireAdmin } from '~/server/admin-auth'
import { jsonResponse, errorResponse } from '~/server/response'
import { oripas, oripaSlots, draws } from '~/server/schema'
import { eq, isNull, sql, and } from 'drizzle-orm'

export const Route = createFileRoute('/api/admin/oripas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await initEnv()
        const env = getEnv()

        const admin = await requireAdmin(request, env)
        if (!admin) return errorResponse('Unauthorized', 401)

        const db = getDb(env.DB)

        const allOripas = await db.select().from(oripas)

        const result = []
        for (const oripa of allOripas) {
          const [totalCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(oripaSlots)
            .where(eq(oripaSlots.oripaId, oripa.id))

          const [remainingCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(oripaSlots)
            .where(and(eq(oripaSlots.oripaId, oripa.id), isNull(oripaSlots.pulledBy)))

          const [pendingCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(draws)
            .where(and(eq(draws.oripaId, oripa.id), eq(draws.status, 'pending')))

          const [drawCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(draws)
            .where(eq(draws.oripaId, oripa.id))

          const pulled = (totalCount?.count ?? 0) - (remainingCount?.count ?? 0)
          const revenue = pulled * oripa.pricePerDraw

          result.push({
            ...oripa,
            lastOnePrize: JSON.parse(oripa.lastOnePrize),
            remaining: remainingCount?.count ?? 0,
            pulled,
            revenue: Math.round(revenue * 100) / 100,
            pendingDraws: pendingCount?.count ?? 0,
            totalDraws: drawCount?.count ?? 0,
          })
        }

        return jsonResponse(result)
      },
    },
  },
})
