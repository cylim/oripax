/**
 * Generate placeholder card art PNGs using HTML Canvas
 * Run: bun run scripts/generate-cards.ts
 */

const CARD_WIDTH = 400
const CARD_HEIGHT = 560

interface CardConfig {
  filename: string
  bgColor: string
  borderColor: string
  pattern: string
  label: string
  sublabel?: string
}

const CARDS: CardConfig[] = [
  // Common (20)
  ...Array.from({ length: 20 }, (_, i) => ({
    filename: `common_${i + 1}.png`,
    bgColor: '#1a1a2e',
    borderColor: '#A0A0A0',
    pattern: 'geometric',
    label: `C-${String(i + 1).padStart(3, '0')}`,
  })),
  // Uncommon (15)
  ...Array.from({ length: 15 }, (_, i) => ({
    filename: `uncommon_${i + 1}.png`,
    bgColor: '#0d2137',
    borderColor: '#2ECC71',
    pattern: 'hexagon',
    label: `U-${String(i + 1).padStart(3, '0')}`,
  })),
  // Rare (8)
  ...Array.from({ length: 8 }, (_, i) => ({
    filename: `rare_${i + 1}.png`,
    bgColor: '#0a1628',
    borderColor: '#3498DB',
    pattern: 'star',
    label: `R-${String(i + 1).padStart(3, '0')}`,
  })),
  // Ultra Rare (5)
  ...Array.from({ length: 5 }, (_, i) => ({
    filename: `ultra_rare_${i + 1}.png`,
    bgColor: '#1a0a2e',
    borderColor: '#9B59B6',
    pattern: 'crystal',
    label: `UR-${String(i + 1).padStart(3, '0')}`,
  })),
  // Secret Rare (2)
  ...Array.from({ length: 2 }, (_, i) => ({
    filename: `secret_rare_${i + 1}.png`,
    bgColor: '#2e1a00',
    borderColor: '#FFB800',
    pattern: 'lightning',
    label: `SR-${String(i + 1).padStart(3, '0')}`,
  })),
  // Last One
  {
    filename: 'last_one_special.png',
    bgColor: '#0a0a0f',
    borderColor: '#FF2D78',
    pattern: 'rainbow',
    label: 'LAST ONE',
    sublabel: 'ラストワン',
  },
]

async function generateSVG(card: CardConfig): Promise<string> {
  const patterns: Record<string, string> = {
    geometric: `
      <pattern id="pat" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="40" height="40" fill="none" stroke="${card.borderColor}20" stroke-width="1"/>
        <line x1="0" y1="0" x2="40" y2="40" stroke="${card.borderColor}15" stroke-width="1"/>
      </pattern>`,
    hexagon: `
      <pattern id="pat" x="0" y="0" width="50" height="44" patternUnits="userSpaceOnUse">
        <polygon points="25,2 47,14 47,36 25,44 3,36 3,14" fill="none" stroke="${card.borderColor}20" stroke-width="1"/>
      </pattern>`,
    star: `
      <pattern id="pat" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
        <polygon points="30,5 35,20 50,20 38,30 42,45 30,36 18,45 22,30 10,20 25,20" fill="none" stroke="${card.borderColor}25" stroke-width="1"/>
      </pattern>`,
    crystal: `
      <pattern id="pat" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
        <polygon points="25,5 45,25 25,45 5,25" fill="none" stroke="${card.borderColor}30" stroke-width="1.5"/>
        <polygon points="25,15 35,25 25,35 15,25" fill="${card.borderColor}10" stroke="none"/>
      </pattern>`,
    lightning: `
      <pattern id="pat" x="0" y="0" width="40" height="60" patternUnits="userSpaceOnUse">
        <polyline points="20,0 10,25 25,25 15,60" fill="none" stroke="${card.borderColor}30" stroke-width="2"/>
      </pattern>`,
    rainbow: `
      <linearGradient id="pat-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#FF2D78;stop-opacity:0.3"/>
        <stop offset="25%" style="stop-color:#FFB800;stop-opacity:0.3"/>
        <stop offset="50%" style="stop-color:#00B4FF;stop-opacity:0.3"/>
        <stop offset="75%" style="stop-color:#00FF88;stop-opacity:0.3"/>
        <stop offset="100%" style="stop-color:#9B59B6;stop-opacity:0.3"/>
      </linearGradient>`,
  }

  const patternDef = patterns[card.pattern] || patterns.geometric!
  const useGradientFill = card.pattern === 'rainbow'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    ${patternDef}
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="12" fill="${card.bgColor}"/>

  <!-- Pattern fill -->
  ${useGradientFill
    ? `<rect x="4" y="4" width="${CARD_WIDTH - 8}" height="${CARD_HEIGHT - 8}" rx="10" fill="url(#pat-grad)"/>`
    : `<rect x="4" y="4" width="${CARD_WIDTH - 8}" height="${CARD_HEIGHT - 8}" rx="10" fill="url(#pat)"/>`
  }

  <!-- Border -->
  <rect x="4" y="4" width="${CARD_WIDTH - 8}" height="${CARD_HEIGHT - 8}" rx="10" fill="none" stroke="${card.borderColor}" stroke-width="3"/>

  <!-- Inner border -->
  <rect x="14" y="14" width="${CARD_WIDTH - 28}" height="${CARD_HEIGHT - 28}" rx="6" fill="none" stroke="${card.borderColor}40" stroke-width="1"/>

  <!-- Card symbol -->
  <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 - 20}" text-anchor="middle" font-family="monospace" font-size="60" fill="${card.borderColor}" filter="url(#glow)">🎴</text>

  <!-- Label -->
  <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 + 50}" text-anchor="middle" font-family="monospace" font-size="24" font-weight="bold" fill="${card.borderColor}" filter="url(#glow)">${card.label}</text>

  ${card.sublabel ? `<text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT / 2 + 80}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="${card.borderColor}CC">${card.sublabel}</text>` : ''}

  <!-- OripaX watermark -->
  <text x="${CARD_WIDTH / 2}" y="${CARD_HEIGHT - 30}" text-anchor="middle" font-family="monospace" font-size="10" fill="${card.borderColor}40">OripaX • X Layer</text>
</svg>`
}

async function main() {
  const outputDir = './public/cards'

  for (const card of CARDS) {
    const svg = await generateSVG(card)
    const path = `${outputDir}/${card.filename.replace('.png', '.svg')}`
    await Bun.write(path, svg)
  }

  console.log(`Generated ${CARDS.length} card SVGs in ${outputDir}/`)
}

main()
