import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/metadata/$cardId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          await initEnv()
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

          // Always use our proxy URL so NFT metadata points to our domain
          const baseUrl = new URL(request.url).origin
          const image = `${baseUrl}/api/card-image/${cardId}`

          const metadata = {
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
          }

          return new Response(JSON.stringify(metadata), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch metadata' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
