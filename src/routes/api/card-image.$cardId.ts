import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { cards } from '~/server/schema'
import { eq } from 'drizzle-orm'

const ALLOWED_IMAGE_HOSTS = ['images.pokemontcg.io']

// In-memory image cache (per-isolate, survives across requests within same Worker instance)
const imageCache = new Map<number, { body: ArrayBuffer; contentType: string }>()

export const Route = createFileRoute('/api/card-image/$cardId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const cardId = parseInt(params.cardId)
          if (Number.isNaN(cardId) || cardId <= 0) {
            return new Response('Invalid card ID', { status: 400 })
          }

          // Serve from in-memory cache if available (no DB hit, no rate limit, no external fetch)
          const cached = imageCache.get(cardId)
          if (cached) {
            return new Response(cached.body, {
              headers: {
                'Content-Type': cached.contentType,
                'Cache-Control': 'public, max-age=86400, s-maxage=604800',
              },
            })
          }

          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          const [card] = await db
            .select({ imageUri: cards.imageUri })
            .from(cards)
            .where(eq(cards.id, cardId))

          if (!card?.imageUri) {
            return new Response('Not found', { status: 404 })
          }

          // SSRF protection — only allow whitelisted image hosts
          let imageUrl: URL
          try {
            imageUrl = new URL(card.imageUri)
          } catch {
            return new Response('Invalid image URL', { status: 500 })
          }

          if (!ALLOWED_IMAGE_HOSTS.includes(imageUrl.hostname)) {
            return new Response('Image source not allowed', { status: 403 })
          }

          // Fetch and cache
          const imageResponse = await fetch(card.imageUri)
          if (!imageResponse.ok) {
            return new Response('Image not available', { status: 502 })
          }

          const body = await imageResponse.arrayBuffer()
          const contentType = imageResponse.headers.get('Content-Type') || 'image/png'

          // Store in memory cache (cap at 500 entries to avoid memory bloat)
          if (imageCache.size < 500) {
            imageCache.set(cardId, { body, contentType })
          }

          return new Response(body, {
            headers: {
              'Content-Type': contentType,
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
