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
            name: `${card.name}`,
            description: `${card.description}\n\nThis is a demo NFT minted during the OripaX test phase. It does not represent any real-world asset or hold any monetary value.`,
            image,
            attributes: [
              { trait_type: 'Rarity', value: card.rarity },
              { trait_type: 'Element', value: card.element },
              { trait_type: 'Set', value: card.setName },
              { trait_type: 'Status', value: 'Demo' },
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
