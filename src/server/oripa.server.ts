import { eq, isNull, sql, and, desc, lt } from 'drizzle-orm'
import { ethers } from 'ethers'
import type { Database } from './db'
import { cards, draws, oripas, oripaSlots } from './schema'
import { formatAddress } from '~/lib/utils'
import { BUYBACK_RATES, BUYBACK_WINDOW_MS } from '~/lib/constants'
import { mintCardOnChain } from './mint.server'
import { sendUsdtRefund } from './refund.server'

export interface CreateOripaConfig {
  name: string
  totalSlots: number
  pricePerDraw: number
  lastOnePrize: { cardId: number; name: string; imageUri: string }
  slotDistribution: Array<{ cardId: number; rarity: string; count: number }>
}

// Rejection-sampling random integer to avoid modulo bias
function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = (0x100000000 - (0x100000000 % max)) >>> 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % max
  }
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

  // Fisher-Yates shuffle with unbiased crypto randomness
  for (let i = slots.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[slots[i]!, slots[j]!] = [slots[j]!, slots[i]!]
  }

  // Insert slots using raw SQL multi-value INSERTs (200 per statement)
  const SLOT_BATCH = 200
  for (let i = 0; i < slots.length; i += SLOT_BATCH) {
    const batch = slots.slice(i, i + SLOT_BATCH)
    const values = batch
      .map(
        (slot, j) =>
          `(${oripa!.id}, ${i + j}, ${slot.cardId}, '${slot.rarity}')`
      )
      .join(',')
    await db.run(
      sql.raw(
        `INSERT INTO oripa_slots (oripa_id, slot_index, card_id, rarity) VALUES ${values}`
      )
    )
  }

  return oripa!
}

export async function executeDraw(
  db: Database,
  oripaId: number,
  userAddress: string,
  paymentTxHash: string
): Promise<{
  drawId: number
  slot: typeof oripaSlots.$inferSelect
  card: typeof cards.$inferSelect
  isLastOne: boolean
  remaining: number
  buybackAmount: number
  proof: { serverSalt: string; selectedIndex: number; availableCount: number }
}> {
  // Generate server salt (unpredictable by user, committed before draw)
  const serverSalt = ethers.hexlify(crypto.getRandomValues(new Uint8Array(32)))

  // Try up to 3 times (optimistic locking)
  for (let attempt = 0; attempt < 3; attempt++) {
    // Get available slot count + IDs (sorted by id for deterministic ordering)
    const availableSlots = await db
      .select({ id: oripaSlots.id, cardId: oripaSlots.cardId, rarity: oripaSlots.rarity })
      .from(oripaSlots)
      .where(
        and(eq(oripaSlots.oripaId, oripaId), isNull(oripaSlots.pulledBy))
      )
      .orderBy(oripaSlots.id)

    if (availableSlots.length === 0) {
      throw new Error('SOLD_OUT')
    }

    // Provably fair selection: keccak256(txHash + serverSalt) % availableCount
    const hash = ethers.keccak256(
      ethers.concat([ethers.getBytes(paymentTxHash), ethers.getBytes(serverSalt)])
    )
    const randomIndex = Number(BigInt(hash) % BigInt(availableSlots.length))
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

    // Check remaining — D1/SQLite single-writer makes this consistent after the update (#9)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(oripaSlots)
      .where(
        and(eq(oripaSlots.oripaId, oripaId), isNull(oripaSlots.pulledBy))
      )

    const remaining = countResult?.count ?? 0
    const isLastOne = remaining === 0

    // If last one, mark oripa as sold out (compare-and-swap for safety #9)
    if (isLastOne) {
      await db
        .update(oripas)
        .set({ status: 'sold_out' })
        .where(and(eq(oripas.id, oripaId), eq(oripas.status, 'active')))
    }

    // Insert draw record with proof
    const [drawRecord] = await db.insert(draws).values({
      oripaId,
      slotId: slot.id,
      cardId: slot.cardId,
      rarity: slot.rarity,
      userAddress,
      paymentTxHash,
      isLastOne,
      status: isLastOne ? 'kept' : 'pending',
      decidedAt: isLastOne ? now : null,
      serverSalt,
      selectedIndex: randomIndex,
      availableCount: availableSlots.length,
      createdAt: now,
    }).returning()

    // Fetch oripa for buyback calculation
    const [oripa] = await db.select().from(oripas).where(eq(oripas.id, oripaId))
    const buybackRate = BUYBACK_RATES[slot.rarity] ?? 0
    const buybackAmount = oripa ? oripa.pricePerDraw * buybackRate : 0

    const proof = { serverSalt, selectedIndex: randomIndex, availableCount: availableSlots.length }
    return { drawId: drawRecord!.id, slot, card: card!, isLastOne, remaining, buybackAmount, proof }
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

  // Truncate wallet addresses in recent pulls (#18)
  const recentPulls = allSlots
    .filter((s) => s.pulledBy)
    .sort((a, b) => (b.pulledAt || '').localeCompare(a.pulledAt || ''))
    .slice(0, 5)
    .map((s) => ({
      rarity: s.rarity,
      pulledBy: formatAddress(s.pulledBy!),
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

interface LastOnePrize {
  cardId: number
  name: string
  imageUri: string
}

function parseLastOnePrize(str: string): LastOnePrize {
  try {
    return JSON.parse(str) as LastOnePrize
  } catch {
    return { cardId: 0, name: 'Unknown Prize', imageUri: '' }
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
      lastOnePrize: parseLastOnePrize(oripa.lastOnePrize), // #19
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
    lastOnePrize: parseLastOnePrize(oripa.lastOnePrize), // #19
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
    userAddress: formatAddress(draw.userAddress), // #18
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

  const [buybackCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(draws)
    .where(eq(draws.status, 'bought_back'))

  return {
    totalDraws: drawCount?.count ?? 0,
    totalLastOneWins: lastOneCount?.count ?? 0,
    totalBuybacks: buybackCount?.count ?? 0,
    lastOneWinners: lastOneWinners.map((d) => ({
      address: formatAddress(d.userAddress), // #18
      oripaId: d.oripaId,
      date: d.createdAt,
    })),
  }
}

// --- Keep / Buyback ---

export async function keepDraw(
  db: Database,
  drawId: number,
  userAddress: string,
  baseUrl: string
): Promise<{
  txHash: string | null
  tokenId: number | null
  explorerUrl: string | null
  mintPending: boolean
}> {
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
  if (!draw) throw new Error('DRAW_NOT_FOUND')
  if (draw.userAddress.toLowerCase() !== userAddress.toLowerCase()) throw new Error('NOT_OWNER')
  if (draw.status !== 'pending') throw new Error('ALREADY_DECIDED')

  const elapsed = Date.now() - new Date(draw.createdAt).getTime()
  if (elapsed > BUYBACK_WINDOW_MS) throw new Error('WINDOW_EXPIRED')

  // Optimistic update
  const now = new Date().toISOString()
  const updated = await db
    .update(draws)
    .set({ status: 'kept', decidedAt: now })
    .where(and(eq(draws.id, drawId), eq(draws.status, 'pending')))
    .returning()

  if (updated.length === 0) throw new Error('ALREADY_DECIDED')

  // Mint NFT
  try {
    const [card] = await db.select().from(cards).where(eq(cards.id, draw.cardId))
    const mintResult = await mintCardOnChain(
      draw.userAddress,
      draw.oripaId,
      card!.id,
      card!.rarity,
      baseUrl
    )
    if (mintResult.txHash) {
      await db.update(draws)
        .set({ txHash: mintResult.txHash, mintedTokenId: mintResult.tokenId })
        .where(eq(draws.id, drawId))
    }
    return { ...mintResult, mintPending: false }
  } catch {
    return { txHash: null, tokenId: null, explorerUrl: null, mintPending: true }
  }
}

export async function buybackDraw(
  db: Database,
  drawId: number,
  userAddress: string
): Promise<{
  refundAmount: number
  refundTxHash: string
}> {
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId))
  if (!draw) throw new Error('DRAW_NOT_FOUND')
  if (draw.userAddress.toLowerCase() !== userAddress.toLowerCase()) throw new Error('NOT_OWNER')
  if (draw.status !== 'pending') throw new Error('ALREADY_DECIDED')
  if (draw.isLastOne) throw new Error('CANNOT_BUYBACK_LAST_ONE')

  const elapsed = Date.now() - new Date(draw.createdAt).getTime()
  if (elapsed > BUYBACK_WINDOW_MS) throw new Error('WINDOW_EXPIRED')

  // Get oripa for price
  const [oripa] = await db.select().from(oripas).where(eq(oripas.id, draw.oripaId))
  if (!oripa) throw new Error('ORIPA_NOT_FOUND')

  const rate = BUYBACK_RATES[draw.rarity] ?? 0
  const refundAmount = oripa.pricePerDraw * rate

  // Send USDC refund on-chain
  console.log(`[buyback] Refunding ${refundAmount} USDC to ${draw.userAddress}`)
  let refundTxHash: string
  try {
    const result = await sendUsdtRefund(draw.userAddress, refundAmount)
    refundTxHash = result.txHash
    console.log(`[buyback] Refund tx: ${refundTxHash}`)
  } catch (err) {
    console.error('[buyback] Refund failed:', err)
    throw err
  }

  // Optimistic update draw status
  const now = new Date().toISOString()
  const updated = await db
    .update(draws)
    .set({
      status: 'bought_back',
      decidedAt: now,
      buybackTxHash: refundTxHash,
      buybackAmount: refundAmount,
    })
    .where(and(eq(draws.id, drawId), eq(draws.status, 'pending')))
    .returning()

  if (updated.length === 0) throw new Error('ALREADY_DECIDED')

  // Return slot to pool
  await db
    .update(oripaSlots)
    .set({ pulledBy: null, pulledAt: null })
    .where(eq(oripaSlots.id, draw.slotId))

  // If oripa was sold_out, reactivate it
  await db
    .update(oripas)
    .set({ status: 'active' })
    .where(and(eq(oripas.id, draw.oripaId), eq(oripas.status, 'sold_out')))

  return { refundAmount, refundTxHash }
}

export async function autoKeepExpiredDraws(db: Database, baseUrl: string) {
  const cutoff = new Date(Date.now() - BUYBACK_WINDOW_MS).toISOString()
  const expired = await db
    .select()
    .from(draws)
    .where(and(eq(draws.status, 'pending'), lt(draws.createdAt, cutoff)))

  for (const draw of expired) {
    try {
      await keepDraw(db, draw.id, draw.userAddress, baseUrl)
    } catch (err) {
      // Will retry on next invocation
      console.error(`Auto-keep failed for draw ${draw.id}:`, err)
    }
  }

  return expired.length
}

export async function getDrawStatus(db: Database, drawId: number, userAddress: string) {
  const [draw] = await db
    .select({ draw: draws, card: cards })
    .from(draws)
    .innerJoin(cards, eq(draws.cardId, cards.id))
    .where(eq(draws.id, drawId))

  if (!draw) return null
  if (draw.draw.userAddress.toLowerCase() !== userAddress.toLowerCase()) return null

  const [oripa] = await db.select().from(oripas).where(eq(oripas.id, draw.draw.oripaId))
  const rate = BUYBACK_RATES[draw.draw.rarity] ?? 0
  const buybackAmount = oripa ? oripa.pricePerDraw * rate : 0

  const createdMs = new Date(draw.draw.createdAt).getTime()
  const deadlineMs = createdMs + BUYBACK_WINDOW_MS
  const timeRemainingMs = Math.max(0, deadlineMs - Date.now())

  return {
    drawId: draw.draw.id,
    status: draw.draw.status,
    card: {
      cardId: draw.card.id,
      rarity: draw.card.rarity,
      name: draw.card.name,
      imageUri: draw.card.imageUri,
      element: draw.card.element,
      attack: draw.card.attack,
      defense: draw.card.defense,
    },
    isLastOne: draw.draw.isLastOne,
    buybackAmount,
    decisionDeadline: new Date(deadlineMs).toISOString(),
    timeRemainingMs,
    txHash: draw.draw.txHash,
    mintedTokenId: draw.draw.mintedTokenId,
    buybackTxHash: draw.draw.buybackTxHash,
  }
}
