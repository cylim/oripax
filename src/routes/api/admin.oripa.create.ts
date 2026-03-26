import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import { getDb } from '~/server/db'
import { requireAdmin } from '~/server/admin-auth'
import { jsonResponse, errorResponse } from '~/server/response'
import { createOripaPool, type CreateOripaConfig } from '~/server/oripa.server'
import { cards } from '~/server/schema'
import { inArray } from 'drizzle-orm'

export const Route = createFileRoute('/api/admin/oripa/create')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await initEnv()
        const env = getEnv()

        const admin = await requireAdmin(request, env)
        if (!admin) return errorResponse('Unauthorized', 401)

        let body: CreateOripaConfig
        try {
          body = await request.json()
        } catch {
          return errorResponse('Invalid JSON', 400)
        }

        // Validate required fields
        if (!body.name?.trim()) return errorResponse('Name is required', 400)
        if (!body.totalSlots || body.totalSlots <= 0) return errorResponse('totalSlots must be > 0', 400)
        if (!body.pricePerDraw || body.pricePerDraw <= 0) return errorResponse('pricePerDraw must be > 0', 400)
        if (!body.lastOnePrize?.cardId) return errorResponse('lastOnePrize.cardId is required', 400)
        if (!body.slotDistribution?.length) return errorResponse('slotDistribution is required', 400)

        // Validate slot counts sum to totalSlots
        const totalDistributed = body.slotDistribution.reduce((sum, d) => sum + d.count, 0)
        if (totalDistributed !== body.totalSlots) {
          return errorResponse(
            `Slot distribution sum (${totalDistributed}) does not match totalSlots (${body.totalSlots})`,
            400
          )
        }

        // Validate all cardIds exist
        const db = getDb(env.DB)
        const allCardIds = [
          body.lastOnePrize.cardId,
          ...body.slotDistribution.map((d) => d.cardId),
        ]
        const uniqueCardIds = [...new Set(allCardIds)]

        const existingCards = await db
          .select({ id: cards.id })
          .from(cards)
          .where(inArray(cards.id, uniqueCardIds))

        const existingIds = new Set(existingCards.map((c) => c.id))
        const missing = uniqueCardIds.filter((id) => !existingIds.has(id))
        if (missing.length > 0) {
          return errorResponse(`Card IDs not found: ${missing.join(', ')}`, 400)
        }

        // Validate rarities
        const validRarities = ['common', 'uncommon', 'rare', 'ultra_rare', 'secret_rare']
        for (const dist of body.slotDistribution) {
          if (!validRarities.includes(dist.rarity)) {
            return errorResponse(`Invalid rarity: ${dist.rarity}`, 400)
          }
        }

        try {
          const oripa = await createOripaPool(db, body)
          return jsonResponse({ success: true, oripa }, 201)
        } catch (err) {
          console.error('Create pool error:', err)
          return errorResponse('Failed to create pool', 500)
        }
      },
    },
  },
})
