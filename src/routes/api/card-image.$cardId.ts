import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit, getClientIp, rateLimitResponse } from '~/server/rate-limit'

const ALLOWED_IMAGE_HOSTS = ['images.pokemontcg.io']

export const Route = createFileRoute('/api/card-image/$cardId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          // Rate limit: 60 image requests per minute per IP
          const rl = checkRateLimit(`img:${getClientIp(request)}`, 60, 60_000)
          if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs)

          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          const cardId = parseInt(params.cardId)
          if (Number.isNaN(cardId) || cardId <= 0) {
            return new Response('Invalid card ID', { status: 400 })
          }

          const [card] = await db
            .select({ imageUri: cards.imageUri })
            .from(cards)
            .where(eq(cards.id, cardId))

          if (!card?.imageUri) {
            return new Response('Not found', { status: 404 })
          }

          // SSRF protection — only allow whitelisted image hosts (#8)
          let imageUrl: URL
          try {
            imageUrl = new URL(card.imageUri)
          } catch {
            return new Response('Invalid image URL', { status: 500 })
          }

          if (!ALLOWED_IMAGE_HOSTS.includes(imageUrl.hostname)) {
            return new Response('Image source not allowed', { status: 403 })
          }

          // Proxy the image
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
