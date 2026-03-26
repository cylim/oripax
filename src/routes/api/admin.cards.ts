import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import { getDb } from '~/server/db'
import { requireAdmin } from '~/server/admin-auth'
import { jsonResponse, errorResponse } from '~/server/response'
import { cards } from '~/server/schema'

export const Route = createFileRoute('/api/admin/cards')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await initEnv()
        const env = getEnv()

        const admin = await requireAdmin(request, env)
        if (!admin) return errorResponse('Unauthorized', 401)

        const db = getDb(env.DB)
        const allCards = await db
          .select({
            id: cards.id,
            name: cards.name,
            rarity: cards.rarity,
            element: cards.element,
            imageUri: cards.imageUri,
            attack: cards.attack,
            defense: cards.defense,
          })
          .from(cards)

        return jsonResponse(allCards)
      },
    },
  },
})
