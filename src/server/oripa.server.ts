import { eq, isNull, sql, and, desc } from 'drizzle-orm'
import type { Database } from './db'
import { cards, draws, oripas, oripaSlots } from './schema'

export interface CreateOripaConfig {
  name: string
  totalSlots: number
  pricePerDraw: number
  lastOnePrize: { cardId: number; name: string; imageUri: string }
  slotDistribution: Array<{ cardId: number; rarity: string; count: number }>
}

export async function createOripaPool(db: Database, config: CreateOripaConfig) {
  const [oripa] = await db
    .insert(oripas)
    .values({
      name: config.name,
      totalSlots: config.totalSlots,
      pricePerDraw: config.pricePerDraw,
      lastOnePrize: JSON.stringify(config.lastOnePrize),
      status: 'active',
      createdAt: new Date().toISOString(),
    })
    .returning()

  // Build slot list from distribution
  const slots: Array<{ cardId: number; rarity: string }> = []
  for (const dist of config.slotDistribution) {
    for (let i = 0; i < dist.count; i++) {
      slots.push({ cardId: dist.cardId, rarity: dist.rarity })
    }
  }

  // Fisher-Yates shuffle with crypto randomness
  const randomValues = new Uint32Array(slots.length)
  crypto.getRandomValues(randomValues)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = randomValues[i]! % (i + 1)
    ;[slots[i]!, slots[j]!] = [slots[j]!, slots[i]!]
  }

  // Insert slots
  const slotValues = slots.map((slot, index) => ({
    oripaId: oripa!.id,
    slotIndex: index,
    cardId: slot.cardId,
    rarity: slot.rarity,
  }))

  // Insert in batches of 50
  for (let i = 0; i < slotValues.length; i += 50) {
    await db.insert(oripaSlots).values(slotValues.slice(i, i + 50))
  }

  return oripa!
}

export async function executeDraw(
  db: Database,
  oripaId: number,
  userAddress: string
): Promise<{
  slot: typeof oripaSlots.$inferSelect
  card: typeof cards.$inferSelect
  isLastOne: boolean
  remaining: number
}> {
  // Try up to 3 times (optimistic locking)
  for (let attempt = 0; attempt < 3; attempt++) {
    // Get a random available slot
    const availableSlots = await db
      .select()
      .from(oripaSlots)
      .where(
        and(eq(oripaSlots.oripaId, oripaId), isNull(oripaSlots.pulledBy))
      )

    if (availableSlots.length === 0) {
      throw new Error('SOLD_OUT')
    }

    // Pick random slot
    const randomIndex = Math.floor(Math.random() * availableSlots.length)
    const targetSlot = availableSlots[randomIndex]!

    // Optimistic update
    const now = new Date().toISOString()
    const updated = await db
      .update(oripaSlots)
      .set({ pulledBy: userAddress, pulledAt: now })
      .where(
        and(
          eq(oripaSlots.id, targetSlot.id),
          isNull(oripaSlots.pulledBy)
        )
      )
      .returning()

    if (updated.length === 0) {
      continue // Slot was taken, retry
    }

    const slot = updated[0]!

    // Get card info
    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, slot.cardId))

    // Check remaining
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(oripaSlots)
      .where(
        and(eq(oripaSlots.oripaId, oripaId), isNull(oripaSlots.pulledBy))
      )

    const remaining = countResult?.count ?? 0
    const isLastOne = remaining === 0

    // If last one, mark oripa as sold out
    if (isLastOne) {
      await db
        .update(oripas)
        .set({ status: 'sold_out' })
        .where(eq(oripas.id, oripaId))
    }

    // Insert draw record
    await db.insert(draws).values({
      oripaId,
      slotId: slot.id,
      cardId: slot.cardId,
      rarity: slot.rarity,
      userAddress,
      isLastOne,
      createdAt: now,
    })

    return { slot, card: card!, isLastOne, remaining }
  }

  throw new Error('DRAW_CONFLICT')
}

export async function getPoolStatus(db: Database, oripaId: number) {
  const [oripa] = await db.select().from(oripas).where(eq(oripas.id, oripaId))
  if (!oripa) return null

  const allSlots = await db
    .select()
    .from(oripaSlots)
    .where(eq(oripaSlots.oripaId, oripaId))

  const total = allSlots.length
  const available = allSlots.filter((s) => !s.pulledBy)
  const remaining = available.length

  const remainingByRarity: Record<string, number> = {}
  for (const slot of available) {
    remainingByRarity[slot.rarity] = (remainingByRarity[slot.rarity] || 0) + 1
  }

  const currentOdds: Record<string, string> = {}
  if (remaining > 0) {
    for (const [rarity, count] of Object.entries(remainingByRarity)) {
      currentOdds[rarity] = ((count / remaining) * 100).toFixed(1) + '%'
    }
  }

  const recentPulls = allSlots
    .filter((s) => s.pulledBy)
    .sort((a, b) => (b.pulledAt || '').localeCompare(a.pulledAt || ''))
    .slice(0, 5)
    .map((s) => ({
      rarity: s.rarity,
      pulledBy: s.pulledBy!,
      slotIndex: s.slotIndex,
    }))

  return {
    total,
    remaining,
    pulled: total - remaining,
    remainingByRarity,
    currentOdds,
    recentPulls,
  }
}

export async function getActiveOripas(db: Database) {
  const activeOripas = await db
    .select()
    .from(oripas)
    .where(eq(oripas.status, 'active'))

  const result = []
  for (const oripa of activeOripas) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(oripaSlots)
      .where(
        and(eq(oripaSlots.oripaId, oripa.id), isNull(oripaSlots.pulledBy))
      )
    result.push({
      ...oripa,
      lastOnePrize: JSON.parse(oripa.lastOnePrize),
      remaining: countResult?.count ?? 0,
    })
  }

  return result
}

export async function getOripaById(db: Database, oripaId: number) {
  const [oripa] = await db.select().from(oripas).where(eq(oripas.id, oripaId))
  if (!oripa) return null

  const pool = await getPoolStatus(db, oripaId)

  return {
    ...oripa,
    lastOnePrize: JSON.parse(oripa.lastOnePrize),
    pool,
  }
}

export async function getRecentDraws(db: Database, limit = 20) {
  const recentDraws = await db
    .select({
      draw: draws,
      card: cards,
    })
    .from(draws)
    .innerJoin(cards, eq(draws.cardId, cards.id))
    .orderBy(desc(draws.createdAt))
    .limit(limit)

  return recentDraws.map(({ draw, card }) => ({
    ...draw,
    card,
  }))
}

export async function getUserDraws(db: Database, userAddress: string) {
  const userDraws = await db
    .select({
      draw: draws,
      card: cards,
    })
    .from(draws)
    .innerJoin(cards, eq(draws.cardId, cards.id))
    .where(eq(draws.userAddress, userAddress.toLowerCase()))
    .orderBy(desc(draws.createdAt))

  return userDraws.map(({ draw, card }) => ({
    ...draw,
    card,
  }))
}

export async function getGlobalStats(db: Database) {
  const [drawCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(draws)

  const [lastOneCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(draws)
    .where(eq(draws.isLastOne, true))

  const lastOneWinners = await db
    .select()
    .from(draws)
    .where(eq(draws.isLastOne, true))
    .orderBy(desc(draws.createdAt))
    .limit(10)

  return {
    totalDraws: drawCount?.count ?? 0,
    totalLastOneWins: lastOneCount?.count ?? 0,
    lastOneWinners: lastOneWinners.map((d) => ({
      address: d.userAddress,
      oripaId: d.oripaId,
      date: d.createdAt,
    })),
  }
}
