import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const dir = import.meta.dir
console.error('[seed-gen] Loading catalog...')

const raw = readFileSync(join(dir, '../src/server/card-catalog.json'), 'utf-8')
const catalog = JSON.parse(raw) as Array<{
  id: number; name: string; rarity: string; element: string
  attack: number; defense: number; imageUri: string; description: string; setName: string
}>

console.error(`[seed-gen] ${catalog.length} cards loaded`)

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i]!, arr[j]!] = [arr[j]!, arr[i]!]
  }
  return arr
}

const lines: string[] = []

// Cards — 500 per INSERT
console.error('[seed-gen] Generating card INSERTs...')
for (let i = 0; i < catalog.length; i += 500) {
  const batch = catalog.slice(i, i + 500)
  const vals = batch.map(c =>
    `(${c.id},'${esc(c.name)}','${esc(c.rarity)}','${esc(c.element)}',${c.attack},${c.defense},'${esc(c.imageUri)}','${esc(c.description)}','${esc(c.setName)}')`
  ).join(',')
  lines.push(`INSERT INTO cards (id,name,rarity,element,attack,defense,image_uri,description,set_name) VALUES ${vals};`)
}

// Pick Last One prizes
const exclude: number[] = []
function pickBest(rarity: string) {
  const card = catalog
    .filter(c => c.rarity === rarity && !exclude.includes(c.id))
    .sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense))[0]
  if (card) exclude.push(card.id)
  return card
}

const secretPrize = pickBest('secret_rare')
const ultraPrize = pickBest('ultra_rare')
const rarePrize = pickBest('rare')

const poolCards = catalog.filter(c => !exclude.includes(c.id))

// Build slots for a pool
function makeSlots(
  oripaId: number,
  name: string,
  total: number,
  price: number,
  prize: typeof secretPrize,
  rarities: string[],
  ratios: Record<string, number>
) {
  const prizeJson = JSON.stringify({
    cardId: prize?.id ?? 1,
    name: prize?.name ?? 'Mystery',
    imageUri: prize?.imageUri ?? ''
  }).replace(/'/g, "''")

  lines.push(`INSERT INTO oripas (id,name,total_slots,price_per_draw,last_one_prize,status,created_at) VALUES (${oripaId},'${esc(name)}',${total},${price},'${prizeJson}','active','${new Date().toISOString()}');`)

  const byRarity: Record<string, typeof catalog> = {}
  for (const c of poolCards.filter(c => rarities.includes(c.rarity))) {
    ;(byRarity[c.rarity] ??= []).push(c)
  }

  const slots: { cardId: number; rarity: string }[] = []
  for (const [rarity, ratio] of Object.entries(ratios)) {
    const count = Math.round(total * ratio)
    const avail = byRarity[rarity] || []
    if (!avail.length) continue
    for (let i = 0; i < count; i++) {
      slots.push({ cardId: avail[i % avail.length]!.id, rarity })
    }
  }

  shuffle(slots)

  for (let i = 0; i < slots.length; i += 500) {
    const batch = slots.slice(i, i + 500)
    const vals = batch.map((s, j) => `(${oripaId},${i + j},${s.cardId},'${s.rarity}')`).join(',')
    lines.push(`INSERT INTO oripa_slots (oripa_id,slot_index,card_id,rarity) VALUES ${vals};`)
  }

  console.error(`[seed-gen] Pool ${oripaId}: ${name} — ${slots.length} slots`)
}

makeSlots(1, 'Starter Box', 1000, 0.01, rarePrize,
  ['common', 'uncommon', 'rare', 'ultra_rare'],
  { common: 0.45, uncommon: 0.30, rare: 0.18, ultra_rare: 0.07 })

makeSlots(2, 'Premium Collection', 500, 0.02, ultraPrize,
  ['common', 'uncommon', 'rare', 'ultra_rare', 'secret_rare'],
  { common: 0.20, uncommon: 0.25, rare: 0.30, ultra_rare: 0.18, secret_rare: 0.07 })

makeSlots(3, 'Ultra Premium', 200, 0.05, secretPrize,
  ['uncommon', 'rare', 'ultra_rare', 'secret_rare'],
  { uncommon: 0.15, rare: 0.30, ultra_rare: 0.35, secret_rare: 0.20 })

const outPath = join(dir, '../seed.sql')
writeFileSync(outPath, lines.join('\n'), 'utf-8')
console.error(`[seed-gen] Done! ${lines.length} statements written to seed.sql`)
