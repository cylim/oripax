export const XLAYER_CHAIN_ID = 196
export const XLAYER_RPC = 'https://rpc.xlayer.tech'
export const XLAYER_EXPLORER = 'https://www.oklink.com/xlayer'
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'
export const USDT_CONTRACT_ADDRESS = '0x1E4a5963aBFD975d8c9021ce480b42188849D41d'

/** Prices per draw in USDT (demo values — represent $50, $200, $500 pools). */
export const POOL_PRICES = {
  STARTER: 0.01,
  PREMIUM: 0.02,
  ULTRA: 0.05,
} as const

export const Rarity = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  ULTRA_RARE: 'ultra_rare',
  SECRET_RARE: 'secret_rare',
  LAST_ONE: 'last_one',
} as const

export type RarityType = (typeof Rarity)[keyof typeof Rarity]

export const RARITY_COLORS: Record<RarityType, string> = {
  common: '#A0A0A0',
  uncommon: '#2ECC71',
  rare: '#3498DB',
  ultra_rare: '#9B59B6',
  secret_rare: '#FFB800',
  last_one: '#FF2D78',
}

export const RARITY_LABELS: Record<RarityType, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra_rare: 'Ultra Rare',
  secret_rare: 'Secret Rare',
  last_one: 'ラストワン',
}

export const BUYBACK_RATES: Record<string, number> = {
  common: 0.20,
  uncommon: 0.30,
  rare: 0.50,
  ultra_rare: 0.80,
  secret_rare: 0.90,
}

export const BUYBACK_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export const RARITY_ORDER: RarityType[] = [
  'common',
  'uncommon',
  'rare',
  'ultra_rare',
  'secret_rare',
  'last_one',
]
