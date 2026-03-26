import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { eq } from 'drizzle-orm'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/metadata/$cardId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          const cardId = parseInt(params.cardId)
          if (Number.isNaN(cardId) || cardId <= 0) return errorResponse('Invalid card ID', 400)

          const [card] = await db
            .select()
            .from(cards)
            .where(eq(cards.id, cardId))

          if (!card) return errorResponse('Card not found', 404)

          const baseUrl = new URL(request.url).origin
          const image = `${baseUrl}/api/card-image/${cardId}`

          return jsonResponse({
            name: card.name,
            description: card.description,
            image,
            attributes: [
              { trait_type: 'Rarity', value: card.rarity },
              { trait_type: 'Element', value: card.element },
              { display_type: 'number', trait_type: 'Attack', value: card.attack },
              { display_type: 'number', trait_type: 'Defense', value: card.defense },
              { trait_type: 'Set', value: card.setName },
            ],
          })
        } catch (err) {
          console.error('Metadata error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
