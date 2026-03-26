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
| GET    | /api/draw/:oripaId          | x402 | Draw a card (pay USDT)              |
| POST   | /api/draws/decide/:drawId   | None | Keep or buyback a pending draw      |
| GET    | /api/draws/status/:drawId   | None | Check pending draw state            |
| GET    | /api/draws/recent           | None | Recent draws                        |
| GET    | /api/draws/user/:addr       | None | User's draw history                 |
| GET    | /api/stats                  | None | Global statistics                   |
| GET    | /api/metadata/:cardId       | None | ERC-721 metadata JSON               |

## x402 Payment Flow

1. Call draw endpoint without payment → receive HTTP 402 + payment details
2. Payment details specify: amount (e.g., $0.10), asset (USDT), network (X Layer / eip155:196), recipient wallet
3. Sign a USDT payment transaction with your wallet
4. Retry the draw endpoint with the signed payment in the `X-PAYMENT` header (base64-encoded)
5. Server verifies payment via OKX x402 facilitator → executes draw → returns card in `pending` status (NFT minted on keep, or refund on buyback)

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

### Successful draw response example (pending — keep/buyback decision required)

```json
{
  "success": true,
  "drawId": 42,
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
  "status": "pending",
  "decisionDeadline": "2025-01-15T12:05:00.000Z",
  "buybackAmount": 0.05,
  "txHash": null,
  "explorerUrl": null,
  "mintPending": true
}
```

### Keep/Buyback decision

After drawing, the user has **5 minutes** to keep or sell back the card.

```bash
# Keep the card (mints NFT)
curl -X POST https://oripax.example.com/api/draws/decide/{drawId} \
  -H "Content-Type: application/json" \
  -d '{"action": "keep", "userAddress": "0x..."}'
# Response: { success, action: "kept", txHash, tokenId, explorerUrl }

# Buyback (sell back for partial USDT refund)
curl -X POST https://oripax.example.com/api/draws/decide/{drawId} \
  -H "Content-Type: application/json" \
  -d '{"action": "buyback", "userAddress": "0x..."}'
# Response: { success, action: "bought_back", refundAmount, refundTxHash }
```

**Buyback rates** (percentage of draw price refunded):
| Rarity | Buyback Rate |
|--------|-------------|
| Common | 20% |
| Uncommon | 30% |
| Rare | 50% |
| Ultra Rare | 80% |
| Secret Rare | 90% |

If the user doesn't decide within 5 minutes, the card is **auto-kept** and the NFT is minted.

### Check pending draw status

```bash
curl https://oripax.example.com/api/draws/status/{drawId}?address=0x...
# Response: { drawId, status, card, buybackAmount, decisionDeadline, timeRemainingMs }
```

### Last One win response example (auto-kept, no buyback option)

```json
{
  "success": true,
  "drawId": 100,
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
  "status": "kept",
  "decisionDeadline": null,
  "buybackAmount": null,
  "txHash": "0xdef456..."
}
```

## Oripa Mechanics

- **Finite pool**: Each oripa has a fixed number of slots (e.g., 100). When all slots are drawn, the oripa is SOLD OUT.
- **Shifting odds**: As cards are drawn, the remaining pool composition changes. If all Commons are drawn first, later draws have much higher rare odds.
- **Last One (ラストワン)**: Whoever draws the final slot wins a bonus grand prize NFT in addition to their regular card. Last One draws are always auto-kept (no buyback option).
- **Keep / Buyback (買取)**: After drawing, users have 5 minutes to keep the card (mint as NFT) or sell it back for a partial USDT refund based on rarity. Bought-back cards return to the pool, keeping it alive longer. If no decision is made, the card is auto-kept.
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
5. **Keep or Buyback**: After drawing, evaluate the card. `POST /api/draws/decide/:drawId` with `{"action": "keep"}` to mint, or `{"action": "buyback"}` to sell back for partial refund. You have 5 minutes to decide.
6. **Strategy**: Buy back low-value commons (20% refund) and reinvest. Keep rares and above. Calculate EV: if `buybackAmount > card_market_value`, sell back.
7. **Monitor**: Watch for pools approaching "Last One" status (remaining ≤ 5) — these are high-value race opportunities
8. **Compete**: Multiple agents can race for the Last One prize — only one wins

### Rate limits

- Max 5 draws per minute per wallet address
- Read endpoints: no rate limit
- Pool status: poll every 3 seconds recommended

### Error codes

| HTTP Status | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| 200         | Success — card drawn (pending decision) or action done   |
| 402         | Payment Required — x402 payment needed                   |
| 403         | Not owner — wallet address doesn't match draw            |
| 404         | Oripa or draw not found                                  |
| 409         | Already decided — draw was already kept or bought back   |
| 410         | Oripa sold out / decision window expired                 |
| 429         | Rate limited — too many requests per minute              |
| 500         | Server error — draw may have succeeded, check tx hash    |
| 503         | Buyback temporarily unavailable (wallet out of USDT)     |

## Admin Portal

The admin portal at `/admin` lets whitelisted wallet addresses manage pools. Authentication uses EIP-191 wallet signatures + JWT tokens.

### Admin API Endpoints

| Method | Endpoint                    | Auth | Description                 |
| ------ | --------------------------- | ---- | --------------------------- |
| POST   | /api/admin/auth/challenge   | None | Get sign-in challenge nonce |
| POST   | /api/admin/auth/login       | None | Submit signature, get JWT   |
| POST   | /api/admin/auth/logout      | JWT  | Clear admin session         |
| GET    | /api/admin/oripas           | JWT  | All pools with admin stats  |
| GET    | /api/admin/cards            | JWT  | Card catalog for selectors  |
| POST   | /api/admin/oripa/create     | JWT  | Create a new pool           |
| POST   | /api/admin/oripa/:id/refill | JWT  | Add slots to existing pool  |
| POST   | /api/admin/oripa/:id/reset  | JWT  | Reset pool (clear pulls)    |

### Create Pool Example

```bash
curl -X POST https://oripax.example.com/api/admin/oripa/create \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=<jwt>" \
  -d '{
    "name": "Custom Collection",
    "totalSlots": 50,
    "pricePerDraw": 0.05,
    "lastOnePrize": { "cardId": 99, "name": "Grand Prize", "imageUri": "/cards/grand.png" },
    "slotDistribution": [
      { "cardId": 1, "rarity": "common", "count": 30 },
      { "cardId": 2, "rarity": "rare", "count": 15 },
      { "cardId": 3, "rarity": "ultra_rare", "count": 5 }
    ]
  }'
```

### Refill Pool Example

```bash
curl -X POST https://oripax.example.com/api/admin/oripa/1/refill \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=<jwt>" \
  -d '{
    "slotDistribution": [
      { "cardId": 1, "rarity": "common", "count": 20 },
      { "cardId": 2, "rarity": "rare", "count": 10 }
    ]
  }'
```

### Reset Pool Example

```bash
# Normal reset (fails if pending draws exist)
curl -X POST https://oripax.example.com/api/admin/oripa/1/reset \
  -H "Cookie: admin_token=<jwt>"

# Force reset (auto-keeps pending draws)
curl -X POST https://oripax.example.com/api/admin/oripa/1/reset \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=<jwt>" \
  -d '{"force": true}'
```

## Built With

- **OKX Onchain OS**: Wallet API, Market API, x402 Payment API
- **X Layer**: EVM-compatible L2 by OKX (Polygon CDK, chain 196)
- **TanStack Start**: Full-stack React framework on Cloudflare Workers
- **Cloudflare D1**: Edge SQLite database
- **x402 Protocol**: HTTP-native micropayments
