import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/cards')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          const allCards = await db
            .select({
              id: cards.id,
              name: cards.name,
              rarity: cards.rarity,
              element: cards.element,
              attack: cards.attack,
              defense: cards.defense,
              imageUri: cards.imageUri,
              setName: cards.setName,
            })
            .from(cards)

          // Return proxy URLs instead of raw external URLs
          const result = allCards.map((c) => ({
            ...c,
            imageUri: `/api/card-image/${c.id}`,
          }))

          return jsonResponse(result)
        } catch (err) {
          console.error('Cards error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
