# OripaX Integration Guide (SKILL.md)

## What is OripaX?

OripaX is an on-chain Oripa (オリパ) gacha system on X Layer. Users draw cards from finite pools by paying x402 micropayments. Cards are ERC-721 NFTs. The "Last One" (ラストワン) mechanic awards a grand prize to whoever draws the final slot.

## Quick Start for Agents & Developers

### 1. Browse available oripas

```bash
curl https://oripax.example.com/api/oripas
```

Returns array of active oripa pools with remaining slots and pricing.

### 2. Check a specific pool

```bash
curl https://oripax.example.com/api/oripa/{oripaId}
```

Returns full pool status: remaining slots, rarity breakdown, current odds, recent pulls.

### 3. Draw a card (requires x402 payment)

```bash
# Step 1: Request draw → get 402 with payment requirements
curl -i https://oripax.example.com/api/draw/{oripaId}
# Response: HTTP 402, body contains payment requirements

# Step 2: Sign USDT payment (your wallet signs the x402 payload)
# Step 3: Retry with payment proof
curl https://oripax.example.com/api/draw/{oripaId} \
  -H "X-PAYMENT: <base64-encoded-payment-payload>"
# Response: { success, card, isLastOne, remaining, txHash }
```

### 4. View collection

```bash
curl https://oripax.example.com/api/draws/user/{walletAddress}
```

### 5. Global stats

```bash
curl https://oripax.example.com/api/stats
```

## API Reference

| Method | Endpoint              | Auth | Description                   |
| ------ | --------------------- | ---- | ----------------------------- |
| GET    | /api/health           | None | Health check                  |
| GET    | /api/oripas           | None | List active oripas            |
| GET    | /api/oripa/:id        | None | Single oripa detail with pool |
| GET    | /api/oripa/:id/pool   | None | Pool status with live odds    |
| GET    | /api/draw/:oripaId    | x402 | Draw a card (pay USDT)        |
| GET    | /api/draws/recent     | None | Recent draws                  |
| GET    | /api/draws/user/:addr | None | User's draw history           |
| GET    | /api/stats            | None | Global statistics             |
| GET    | /api/metadata/:cardId | None | ERC-721 metadata JSON         |

## x402 Payment Flow

1. Call draw endpoint without payment → receive HTTP 402 + payment details
2. Payment details specify: amount (e.g., $0.10), asset (USDT), network (X Layer / eip155:196), recipient wallet
3. Sign a USDT payment transaction with your wallet
4. Retry the draw endpoint with the signed payment in the `X-PAYMENT` header (base64-encoded)
5. Server verifies payment via OKX x402 facilitator → executes draw → mints NFT → returns card

### Payment response (402) example

```json
{
  "type": "x402",
  "version": "1.0",
  "accepts": [
    {
      "scheme": "exact",
      "price": "$0.10",
      "network": "eip155:196",
      "asset": "USDT",
      "payTo": "0x..."
    }
  ],
  "description": "Draw from Genesis Collection Vol. 1 (73/100 remaining)"
}
```

### Successful draw response example

```json
{
  "success": true,
  "card": {
    "cardId": 36,
    "rarity": "rare",
    "name": "Cyber Dragon #036",
    "imageUri": "/cards/rare_1.png",
    "element": "fire",
    "attack": 55,
    "defense": 45
  },
  "isLastOne": false,
  "lastOnePrize": null,
  "remainingSlots": 72,
  "totalSlots": 100,
  "txHash": "0xabc123...",
  "explorerUrl": "https://www.oklink.com/xlayer/tx/0xabc123..."
}
```

### Last One win response example

```json
{
  "success": true,
  "card": {
    "cardId": 12,
    "rarity": "common",
    "name": "Pixel Spirit #012"
  },
  "isLastOne": true,
  "lastOnePrize": {
    "cardId": 99,
    "name": "Void Monarch EX — Last One Edition",
    "rarity": "last_one",
    "imageUri": "/cards/last_one_special.png"
  },
  "remainingSlots": 0,
  "totalSlots": 100,
  "txHash": "0xdef456..."
}
```

## Oripa Mechanics

- **Finite pool**: Each oripa has a fixed number of slots (e.g., 100). When all slots are drawn, the oripa is SOLD OUT.
- **Shifting odds**: As cards are drawn, the remaining pool composition changes. If all Commons are drawn first, later draws have much higher rare odds.
- **Last One (ラストワン)**: Whoever draws the final slot wins a bonus grand prize NFT in addition to their regular card.
- **Transparency**: Pool composition and remaining cards are always queryable via the API. All pull history is stored on-chain as ERC-721 mint events.

## Pool status response example

```json
{
  "total": 100,
  "remaining": 37,
  "pulled": 63,
  "remainingByRarity": {
    "common": 15,
    "uncommon": 10,
    "rare": 7,
    "ultra_rare": 4,
    "secret_rare": 1
  },
  "currentOdds": {
    "common": "40.5%",
    "uncommon": "27.0%",
    "rare": "18.9%",
    "ultra_rare": "10.8%",
    "secret_rare": "2.7%"
  },
  "recentPulls": [
    { "rarity": "uncommon", "pulledBy": "0xab12...cd34", "slotIndex": 42 },
    { "rarity": "common", "pulledBy": "0xef56...gh78", "slotIndex": 67 }
  ]
}
```

## Chain Details

- **Network**: X Layer Mainnet
- **Chain ID**: 196
- **CAIP-2**: eip155:196
- **RPC**: https://rpc.xlayer.tech
- **Explorer**: https://www.oklink.com/xlayer
- **Gas token**: OKB
- **Payment token**: USDT (gas-free via x402 on X Layer)
- **NFT standard**: ERC-721 (OripaX contract)

## For AI Agents

OripaX is designed for autonomous agent interaction. A recommended agent workflow:

1. **Discover**: `GET /api/oripas` → find pools with favorable odds
2. **Analyze**: `GET /api/oripa/:id/pool` → calculate expected value from remaining rarity distribution
3. **Decide**: If `ultra_rare_remaining / total_remaining > your_threshold`, proceed
4. **Pay & Draw**: `GET /api/draw/:oripaId` → handle 402 → sign x402 payment → retry with X-PAYMENT header
5. **Monitor**: Watch for pools approaching "Last One" status (remaining ≤ 5) — these are high-value race opportunities
6. **Compete**: Multiple agents can race for the Last One prize — only one wins

### Rate limits

- Max 5 draws per minute per wallet address
- Read endpoints: no rate limit
- Pool status: poll every 3 seconds recommended

### Error codes

| HTTP Status | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| 200         | Success — card drawn and minted                       |
| 402         | Payment Required — x402 payment needed                |
| 404         | Oripa not found                                       |
| 410         | Oripa sold out (Gone)                                 |
| 429         | Rate limited — too many draws per minute              |
| 500         | Server error — draw may have succeeded, check tx hash |

## Built With

- **OKX Onchain OS**: Wallet API, Market API, x402 Payment API
- **X Layer**: EVM-compatible L2 by OKX (Polygon CDK, chain 196)
- **TanStack Start**: Full-stack React framework on Cloudflare Workers
- **Cloudflare D1**: Edge SQLite database
- **x402 Protocol**: HTTP-native micropayments
