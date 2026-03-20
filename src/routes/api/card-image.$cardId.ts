import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/card-image/$cardId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)
          const cardId = parseInt(params.cardId)

          const [card] = await db
            .select({ imageUri: cards.imageUri })
            .from(cards)
            .where(eq(cards.id, cardId))

          if (!card?.imageUri) {
            return new Response('Not found', { status: 404 })
          }

          // Proxy the image from the external source
          const imageResponse = await fetch(card.imageUri)
          if (!imageResponse.ok) {
            return new Response('Image not available', { status: 502 })
          }

          return new Response(imageResponse.body, {
            headers: {
              'Content-Type': imageResponse.headers.get('Content-Type') || 'image/png',
              'Cache-Control': 'public, max-age=86400, s-maxage=604800',
            },
          })
        } catch {
          return new Response('Internal error', { status: 500 })
        }
      },
    },
  },
})
