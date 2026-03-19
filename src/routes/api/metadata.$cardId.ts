import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/metadata/$cardId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const env = getEnv()
        const db = getDb(env.DB)
        const cardId = parseInt(params.cardId)

        const [card] = await db
          .select()
          .from(cards)
          .where(eq(cards.id, cardId))

        if (!card) {
          return new Response(JSON.stringify({ error: 'Card not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const baseUrl = new URL(request.url).origin
        const metadata = {
          name: card.name,
          description: card.description,
          image: `${baseUrl}${card.imageUri}`,
          attributes: [
            { trait_type: 'Rarity', value: card.rarity },
            { trait_type: 'Element', value: card.element },
            { trait_type: 'Attack', value: card.attack },
            { trait_type: 'Defense', value: card.defense },
            { trait_type: 'Set', value: card.setName },
          ],
        }

        return new Response(JSON.stringify(metadata), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
