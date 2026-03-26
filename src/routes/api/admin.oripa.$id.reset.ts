import { createFileRoute } from '@tanstack/react-router'
import { getEnv, initEnv } from '~/server/env'
import { getDb } from '~/server/db'
import { requireAdmin } from '~/server/admin-auth'
import { jsonResponse, errorResponse } from '~/server/response'
import { oripas, oripaSlots, draws } from '~/server/schema'
import { eq, and, sql } from 'drizzle-orm'

// Rejection-sampling random integer (same as oripa.server.ts)
function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = (0x100000000 - (0x100000000 % max)) >>> 0
  while (true) {
    crypto.getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % max
  }
}

export const Route = createFileRoute('/api/admin/oripa/$id/reset')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        await initEnv()
        const env = getEnv()

        const admin = await requireAdmin(request, env)
        if (!admin) return errorResponse('Unauthorized', 401)

        const oripaId = parseInt(params.id, 10)
        if (isNaN(oripaId)) return errorResponse('Invalid oripa ID', 400)

        let body: { force?: boolean } = {}
        try {
          body = await request.json()
        } catch {
          // No body is fine
        }

        const db = getDb(env.DB)

        // Verify oripa exists
        const [oripa] = await db.select().from(oripas).where(eq(oripas.id, oripaId))
        if (!oripa) return errorResponse('Oripa not found', 404)

        // Check for pending draws
        const [pendingResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(draws)
          .where(and(eq(draws.oripaId, oripaId), eq(draws.status, 'pending')))

        const pendingCount = pendingResult?.count ?? 0

        if (pendingCount > 0 && !body.force) {
          return errorResponse(
            `Cannot reset: pool has ${pendingCount} pending draw(s). Use force: true to auto-keep them, or wait for the buyback window to expire.`,
            409
          )
        }

        // Force-keep any pending draws (without minting — admin responsibility)
        if (pendingCount > 0) {
          const now = new Date().toISOString()
          await db
            .update(draws)
            .set({ status: 'kept', decidedAt: now })
            .where(and(eq(draws.oripaId, oripaId), eq(draws.status, 'pending')))
        }

        // Clear all pulls on slots
        await db
          .update(oripaSlots)
          .set({ pulledBy: null, pulledAt: null })
          .where(eq(oripaSlots.oripaId, oripaId))

        // Re-shuffle card assignments for unpredictability
        const allSlots = await db
          .select({ id: oripaSlots.id, cardId: oripaSlots.cardId, rarity: oripaSlots.rarity })
          .from(oripaSlots)
          .where(eq(oripaSlots.oripaId, oripaId))

        // Fisher-Yates shuffle the card/rarity assignments
        const assignments = allSlots.map((s) => ({ cardId: s.cardId, rarity: s.rarity }))
        for (let i = assignments.length - 1; i > 0; i--) {
          const j = secureRandomInt(i + 1)
          ;[assignments[i]!, assignments[j]!] = [assignments[j]!, assignments[i]!]
        }

        // Update each slot with its new assignment (batch updates)
        for (let i = 0; i < allSlots.length; i++) {
          await db
            .update(oripaSlots)
            .set({ cardId: assignments[i]!.cardId, rarity: assignments[i]!.rarity })
            .where(eq(oripaSlots.id, allSlots[i]!.id))
        }

        // Set status to active
        await db
          .update(oripas)
          .set({ status: 'active' })
          .where(eq(oripas.id, oripaId))

        return jsonResponse({
          success: true,
          totalSlots: oripa.totalSlots,
          pendingForceKept: pendingCount > 0 ? pendingCount : 0,
          status: 'active',
        })
      },
    },
  },
})
