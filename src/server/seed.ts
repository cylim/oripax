import type { Database } from './db'
import { cards, oripas } from './schema'
import { sql } from 'drizzle-orm'

/**
 * Check seed status. The actual seeding is done via the CLI script:
 *   bun scripts/seed-pools.ts
 *   npx wrangler d1 execute oripax-db --local --file seed.sql
 *
 * This endpoint only reports the current state.
 */
export async function seedStatus(db: Database) {
  const [cardCount] = await db.select({ count: sql<number>`count(*)` }).from(cards)
  const [oripaCount] = await db.select({ count: sql<number>`count(*)` }).from(oripas)

  return {
    cards: cardCount?.count ?? 0,
    oripas: oripaCount?.count ?? 0,
    seeded: (cardCount?.count ?? 0) > 0 && (oripaCount?.count ?? 0) > 0,
  }
}
