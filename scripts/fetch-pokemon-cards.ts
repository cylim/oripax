/**
 * Fetches Pokemon card data from the PokemonTCG GitHub data repo
 * (no API rate limits) and saves as a JSON catalog for the seed script.
 *
 * Usage: bun run scripts/fetch-pokemon-cards.ts
 */

const GITHUB_RAW = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en'
const TARGET_CARDS = 1800
const OUT_PATH = new URL('../src/server/card-catalog.json', import.meta.url).pathname

const SET_NAMES: Record<string, string> = {
  sv1: 'Scarlet & Violet', sv2: 'Paldea Evolved', sv3: 'Obsidian Flames',
  sv3pt5: '151', sv4: 'Paradox Rift', sv4pt5: 'Paldean Fates',
  sv5: 'Temporal Forces', sv6: 'Twilight Masquerade', sv6pt5: 'Shrouded Fable',
  sv7: 'Stellar Crown', sv8: 'Surging Sparks',
  swsh1: 'Sword & Shield', swsh2: 'Rebel Clash', swsh3: 'Darkness Ablaze',
  swsh4: 'Vivid Voltage', swsh5: 'Battle Styles', swsh6: 'Chilling Reign',
  swsh7: 'Evolving Skies', swsh8: 'Fusion Strike', swsh9: 'Brilliant Stars',
  swsh10: 'Astral Radiance', swsh11: 'Lost Origin', swsh12: 'Silver Tempest',
  swsh12pt5: 'Crown Zenith',
  sm1: 'Sun & Moon', sm2: 'Guardians Rising', sm3: 'Burning Shadows',
  sm35: 'Shining Legends', sm4: 'Crimson Invasion', sm5: 'Ultra Prism',
  sm6: 'Forbidden Light', sm7: 'Celestial Storm', sm75: 'Dragon Majesty',
  sm8: 'Lost Thunder', sm9: 'Team Up', sm10: 'Unbroken Bonds',
  sm11: 'Unified Minds', sm12: 'Cosmic Eclipse', sm115: 'Hidden Fates',
  xy1: 'XY', xy2: 'Flashfire', xy3: 'Furious Fists', xy4: 'Phantom Forces',
  xy5: 'Primal Clash', xy6: 'Roaring Skies', xy7: 'Ancient Origins',
  xy8: 'BREAKthrough', xy9: 'BREAKpoint', xy10: 'Fates Collide',
  xy11: 'Steam Siege', xy12: 'Evolutions',
  bw1: 'Black & White', bw2: 'Emerging Powers', bw3: 'Noble Victories',
  bw4: 'Next Destinies', bw5: 'Dark Explorers', bw6: 'Dragons Exalted',
  bw7: 'Boundaries Crossed', bw8: 'Plasma Storm', bw9: 'Plasma Freeze',
  bw10: 'Plasma Blast', bw11: 'Legendary Treasures',
  cel25: 'Celebrations', pgo: 'Pokémon GO',
}

// Modern sets with the best card art
const SETS = [
  // Scarlet & Violet
  'sv1', 'sv2', 'sv3', 'sv3pt5', 'sv4', 'sv4pt5', 'sv5', 'sv6', 'sv6pt5', 'sv7', 'sv8',
  // Sword & Shield
  'swsh1', 'swsh2', 'swsh3', 'swsh4', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9',
  'swsh10', 'swsh11', 'swsh12', 'swsh12pt5',
  // Sun & Moon
  'sm1', 'sm2', 'sm3', 'sm35', 'sm4', 'sm5', 'sm6', 'sm7', 'sm75', 'sm8', 'sm9',
  'sm10', 'sm11', 'sm12', 'sm115',
  // XY
  'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'xy8', 'xy9', 'xy10', 'xy11', 'xy12',
  // Black & White
  'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10', 'bw11',
  // Celebrations & special
  'cel25', 'pgo',
]

interface RawCard {
  id: string
  name: string
  supertype: string
  hp?: string
  types?: string[]
  rarity?: string
  images?: {
    small: string
    large: string
  }
  set?: {
    id: string
    name: string
    series: string
  }
  attacks?: Array<{ name: string; damage: string }>
  artist?: string
}

function mapRarity(pokemonRarity: string | undefined): string {
  if (!pokemonRarity) return 'common'
  const r = pokemonRarity.toLowerCase()

  if (r.includes('secret') || r.includes('rainbow') || r.includes('hyper') || r.includes('shiny gold') || r.includes('special art'))
    return 'secret_rare'
  if (r.includes('ultra') || r.includes('full art') || r.includes(' ex') || r.includes(' gx') ||
      r.includes(' vmax') || r.includes(' vstar') || r.includes('illustration') || r.includes(' v '))
    return 'ultra_rare'
  if (r.includes('rare holo') || r.includes('rare prime') || r.includes('rare break') ||
      r.includes('amazing') || r.includes('radiant'))
    return 'rare'
  if (r === 'rare')
    return 'rare'
  if (r.includes('uncommon'))
    return 'uncommon'
  return 'common'
}

function deriveStats(card: RawCard): { attack: number; defense: number } {
  const hp = parseInt(card.hp || '0') || 50
  const maxDamage = card.attacks?.reduce((max, atk) => {
    const dmg = parseInt(atk.damage?.replace(/[^0-9]/g, '') || '0') || 0
    return Math.max(max, dmg)
  }, 0) ?? 10

  const attack = Math.min(99, Math.max(1, Math.round(maxDamage / 3)))
  const defense = Math.min(99, Math.max(1, Math.round(hp / 3.5)))
  return { attack, defense }
}

async function fetchSet(setId: string): Promise<RawCard[]> {
  const url = `${GITHUB_RAW}/${setId}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`  ⚠ ${setId}: ${res.status}`)
      return []
    }
    return res.json() as Promise<RawCard[]>
  } catch (e) {
    console.log(`  ⚠ ${setId}: fetch error`)
    return []
  }
}

async function main() {
  const allCards: any[] = []
  const seenNames = new Set<string>()

  for (const setId of SETS) {
    if (allCards.length >= TARGET_CARDS) break

    console.log(`Fetching ${setId}...`)
    const rawCards = await fetchSet(setId)

    let added = 0
    for (const card of rawCards) {
      if (allCards.length >= TARGET_CARDS) break
      if (card.supertype !== 'Pokémon') continue
      if (!card.images?.large) continue

      // Deduplicate by name+rarity to get more variety
      const key = `${card.name}|${card.rarity}`
      if (seenNames.has(key)) continue
      seenNames.add(key)

      const rarity = mapRarity(card.rarity)
      const { attack, defense } = deriveStats(card)
      const element = card.types?.[0]?.toLowerCase() || 'normal'

      allCards.push({
        id: allCards.length + 1,
        externalId: card.id,
        name: card.name,
        rarity,
        element,
        attack,
        defense,
        imageUri: card.images.large,
        imageSmall: card.images.small,
        description: `${card.name} from ${SET_NAMES[setId] ?? setId}`,
        setName: SET_NAMES[setId] ?? setId,
        artist: card.artist || 'Unknown',
        originalRarity: card.rarity || 'Unknown',
      })
      added++
    }

    console.log(`  +${added} cards (total: ${allCards.length})`)

    // Small delay to be polite
    await new Promise(r => setTimeout(r, 100))
  }

  // Final save
  await Bun.write(OUT_PATH, JSON.stringify(allCards, null, 2))

  const counts: Record<string, number> = {}
  for (const c of allCards) {
    counts[c.rarity] = (counts[c.rarity] || 0) + 1
  }
  console.log(`\nDone! ${allCards.length} Pokemon cards:`)
  console.log(counts)
  console.log(`Saved to ${OUT_PATH}`)
}

main().catch(console.error)
