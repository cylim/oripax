import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import { getDb } from '~/server/db'
import { requireAdmin } from '~/server/admin-auth'
import { jsonResponse, errorResponse } from '~/server/response'
import { oripas, oripaSlots, cards } from '~/server/schema'
import { eq, sql, and, inArray } from 'drizzle-orm'

// Rejection-sampling random integer (same as oripa.server.ts)
function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = (0x100000000 - (0x100000000 % max)) >>> 0
  while (true) {
    crypto.getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % max
  }
}

export const Route = createFileRoute('/api/admin/oripa/$id/refill')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await initEnv()
        const env = getEnv()

        const admin = await requireAdmin(request, env)
        if (!admin) return errorResponse('Unauthorized', 401)

        const oripaId = parseInt(params.id, 10)
        if (isNaN(oripaId)) return errorResponse('Invalid oripa ID', 400)

        let body: {
          slotDistribution: Array<{ cardId: number; rarity: string; count: number }>
        }
        try {
          body = await request.json()
        } catch {
          return errorResponse('Invalid JSON', 400)
        }

        if (!body.slotDistribution?.length) {
          return errorResponse('slotDistribution is required', 400)
        }

        const db = getDb(env.DB)

        // Verify oripa exists
        const [oripa] = await db.select().from(oripas).where(eq(oripas.id, oripaId))
        if (!oripa) return errorResponse('Oripa not found', 404)

        // Validate cardIds exist
        const uniqueCardIds = [...new Set(body.slotDistribution.map((d) => d.cardId))]
        const existingCards = await db
          .select({ id: cards.id })
          .from(cards)
          .where(inArray(cards.id, uniqueCardIds))

        const existingIds = new Set(existingCards.map((c) => c.id))
        const missing = uniqueCardIds.filter((id) => !existingIds.has(id))
        if (missing.length > 0) {
          return errorResponse(`Card IDs not found: ${missing.join(', ')}`, 400)
        }

        // Get current max slot index
        const [maxResult] = await db
          .select({ maxIndex: sql<number>`coalesce(max(${oripaSlots.slotIndex}), -1)` })
          .from(oripaSlots)
          .where(eq(oripaSlots.oripaId, oripaId))

        const startIndex = (maxResult?.maxIndex ?? -1) + 1

        // Build new slot list
        const slots: Array<{ cardId: number; rarity: string }> = []
        for (const dist of body.slotDistribution) {
          for (let i = 0; i < dist.count; i++) {
            slots.push({ cardId: dist.cardId, rarity: dist.rarity })
          }
        }

        // Fisher-Yates shuffle
        for (let i = slots.length - 1; i > 0; i--) {
          const j = secureRandomInt(i + 1)
          ;[slots[i]!, slots[j]!] = [slots[j]!, slots[i]!]
        }

        // Insert new slots in batches
        const slotValues = slots.map((slot, index) => ({
          oripaId,
          slotIndex: startIndex + index,
          cardId: slot.cardId,
          rarity: slot.rarity,
        }))

        for (let i = 0; i < slotValues.length; i += 10) {
          await db.insert(oripaSlots).values(slotValues.slice(i, i + 10))
        }

        // Update total slots
        const newTotal = oripa.totalSlots + slots.length
        await db
          .update(oripas)
          .set({ totalSlots: newTotal })
          .where(eq(oripas.id, oripaId))

        // Reactivate if sold out
        if (oripa.status === 'sold_out') {
          await db
            .update(oripas)
            .set({ status: 'active' })
            .where(and(eq(oripas.id, oripaId), eq(oripas.status, 'sold_out')))
        }

        return jsonResponse({
          success: true,
          added: slots.length,
          newTotal,
          status: oripa.status === 'sold_out' ? 'active' : oripa.status,
        })
      },
    },
  },
})
