import type { Database } from './db'
import { cards } from './schema'
import { createOripaPool, type CreateOripaConfig } from './oripa.server'
import { sql } from 'drizzle-orm'
import { POOL_PRICES } from '~/lib/constants'

interface CatalogCard {
  id: number
  externalId: string
  name: string
  rarity: string
  element: string
  attack: number
  defense: number
  imageUri: string
  imageSmall: string
  description: string
  setName: string
  artist: string
  originalRarity: string
}

// Pick the best card of a given rarity for Last One prizes
function pickLastOneCard(catalog: CatalogCard[], rarity: string, exclude: number[]): CatalogCard | undefined {
  return catalog
    .filter(c => c.rarity === rarity && !exclude.includes(c.id))
    .sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense))[0]
}

// Build a slot distribution from a pool of cards
function buildDistribution(
  pool: CatalogCard[],
  totalSlots: number,
  ratios: Record<string, number>
): CreateOripaConfig['slotDistribution'] {
  const distribution: CreateOripaConfig['slotDistribution'] = []
  const byRarity: Record<string, CatalogCard[]> = {}

  for (const card of pool) {
    if (!byRarity[card.rarity]) byRarity[card.rarity] = []
    byRarity[card.rarity]!.push(card)
  }

  for (const [rarity, ratio] of Object.entries(ratios)) {
    const slotCount = Math.round(totalSlots * ratio)
    const available = byRarity[rarity] || []
    if (available.length === 0) continue

    let remaining = slotCount
    for (let i = 0; i < available.length && remaining > 0; i++) {
      const count = Math.max(1, Math.round(slotCount / available.length))
      const actual = Math.min(count, remaining)
      distribution.push({ cardId: available[i]!.id, rarity, count: actual })
      remaining -= actual
    }

    let idx = 0
    while (remaining > 0) {
      distribution.push({ cardId: available[idx % available.length]!.id, rarity, count: 1 })
      remaining--
      idx++
    }
  }

  return distribution
}

export async function seedDatabase(db: Database) {
  // Idempotent guard
  const existing = await db.select({ count: sql<number>`count(*)` }).from(cards)
  if ((existing[0]?.count ?? 0) > 0) {
    return { status: 'already_seeded', cards: 0, oripas: 0 }
  }

  // Lazy-load the 776KB card catalog only when actually seeding
  const catalogModule = await import('./card-catalog.json')
  const catalog: CatalogCard[] = (catalogModule.default ?? catalogModule) as CatalogCard[]

  if (catalog.length === 0) {
    throw new Error('Card catalog is empty. Run: bun run scripts/fetch-pokemon-cards.ts')
  }

  // Insert all cards into DB
  const allCards = catalog.map((c) => ({
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    element: c.element,
    attack: c.attack,
    defense: c.defense,
    imageUri: c.imageUri,
    description: c.description,
    setName: c.setName,
  }))

  // D1 has a limit of ~100 bind params per query, so insert in small batches
  for (let i = 0; i < allCards.length; i += 10) {
    await db.insert(cards).values(allCards.slice(i, i + 10))
  }

  // --- Pick 3 unique Last One prizes (best cards of each top rarity) ---
  const lastOnePrizeIds: number[] = []

  const ultraLastOne = pickLastOneCard(catalog, 'secret_rare', lastOnePrizeIds)
  if (ultraLastOne) lastOnePrizeIds.push(ultraLastOne.id)

  const premiumLastOne = pickLastOneCard(catalog, 'ultra_rare', lastOnePrizeIds)
  if (premiumLastOne) lastOnePrizeIds.push(premiumLastOne.id)

  const starterLastOne = pickLastOneCard(catalog, 'rare', lastOnePrizeIds)
  if (starterLastOne) lastOnePrizeIds.push(starterLastOne.id)

  // Exclude last-one prizes from the regular pools
  const poolCards = catalog.filter(c => !lastOnePrizeIds.includes(c.id))

  // --- Pool 1: Starter Box — 1000 slots, $0.01 (represents $50 pool) ---
  const starterPool = poolCards.filter(c =>
    ['common', 'uncommon', 'rare', 'ultra_rare'].includes(c.rarity)
  )
  const starterDist = buildDistribution(starterPool, 1000, {
    common: 0.45,
    uncommon: 0.30,
    rare: 0.18,
    ultra_rare: 0.07,
  })

  await createOripaPool(db, {
    name: 'Starter Box',
    totalSlots: 1000,
    pricePerDraw: POOL_PRICES.STARTER,
    lastOnePrize: {
      cardId: starterLastOne?.id ?? poolCards[0]!.id,
      name: starterLastOne?.name ?? 'Mystery Prize',
      imageUri: starterLastOne?.imageUri ?? '',
    },
    slotDistribution: starterDist,
  })

  // --- Pool 2: Premium Collection — 500 slots, $0.02 (represents $200 pool) ---
  const premiumPool = poolCards.filter(c =>
    ['common', 'uncommon', 'rare', 'ultra_rare', 'secret_rare'].includes(c.rarity)
  )
  const premiumDist = buildDistribution(premiumPool, 500, {
    common: 0.20,
    uncommon: 0.25,
    rare: 0.30,
    ultra_rare: 0.18,
    secret_rare: 0.07,
  })

  await createOripaPool(db, {
    name: 'Premium Collection',
    totalSlots: 500,
    pricePerDraw: POOL_PRICES.PREMIUM,
    lastOnePrize: {
      cardId: premiumLastOne?.id ?? poolCards[0]!.id,
      name: premiumLastOne?.name ?? 'Mystery Prize',
      imageUri: premiumLastOne?.imageUri ?? '',
    },
    slotDistribution: premiumDist,
  })

  // --- Pool 3: Ultra Premium — 200 slots, $0.05 (represents $500 pool) ---
  const ultraPool = poolCards.filter(c =>
    ['uncommon', 'rare', 'ultra_rare', 'secret_rare'].includes(c.rarity)
  )
  const ultraDist = buildDistribution(ultraPool, 200, {
    uncommon: 0.15,
    rare: 0.30,
    ultra_rare: 0.35,
    secret_rare: 0.20,
  })

  await createOripaPool(db, {
    name: 'Ultra Premium',
    totalSlots: 200,
    pricePerDraw: POOL_PRICES.ULTRA,
    lastOnePrize: {
      cardId: ultraLastOne?.id ?? poolCards[0]!.id,
      name: ultraLastOne?.name ?? 'Mystery Prize',
      imageUri: ultraLastOne?.imageUri ?? '',
    },
    slotDistribution: ultraDist,
  })

  return { status: 'seeded', cards: allCards.length, oripas: 3 }
}
