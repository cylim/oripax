import { XLAYER_EXPLORER, RARITY_COLORS, type RarityType } from './constants'

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function explorerTxUrl(txHash: string): string {
  return `${XLAYER_EXPLORER}/tx/${txHash}`
}

export function explorerAddressUrl(address: string): string {
  return `${XLAYER_EXPLORER}/address/${address}`
}

export function rarityToColor(rarity: RarityType): string {
  return RARITY_COLORS[rarity] || '#A0A0A0'
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}
