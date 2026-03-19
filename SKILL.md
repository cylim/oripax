# OripaX Integration Guide (SKILL.md)

## What is OripaX?

OripaX is an on-chain Oripa (オリパ) gacha system on X Layer. Users draw cards from finite pools by paying x402 micropayments. Cards are ERC-721 NFTs.

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
2. Payment details specify: amount (e.g., $0.10), asset (USDT), network (X Layer / eip155:196), recipient
3. Sign a USDT payment transaction with your wallet
4. Retry the draw endpoint with the signed payment in the `X-PAYMENT` header (base64-encoded)
5. Server verifies payment via OKX x402 facilitator → executes draw → mints NFT → returns card

## Oripa Mechanics

- **Finite pool**: Each oripa has a fixed number of slots (e.g., 100). When all slots are drawn, the oripa is SOLD OUT.
- **Shifting odds**: As cards are drawn, the remaining pool composition changes. If all Commons are drawn first, later draws have higher rare odds.
- **Last One (ラストワン)**: Whoever draws the final slot wins a bonus grand prize NFT in addition to their regular card.
- **Transparency**: Pool composition and remaining cards are always queryable via the API.

## Chain Details

- **Network**: X Layer Mainnet
- **Chain ID**: 196
- **RPC**: https://rpc.xlayer.tech
- **Explorer**: https://www.oklink.com/xlayer
- **Gas token**: OKB
- **Payment token**: USDT (gas-free via x402 on X Layer)
- **NFT contract**: ERC-721 (OripaX)

## For AI Agents

OripaX is designed for autonomous agent interaction. An AI agent workflow:

1. Poll `/api/oripas` to find pools with favorable odds
2. Check `/api/oripa/:id/pool` to see remaining rarity distribution
3. Calculate expected value: if remaining ultra_rares / remaining_total > threshold, draw
4. Execute x402 payment and draw
5. Monitor for "Last One" opportunities (remaining ≤ 5 slots)

Built on OKX Onchain OS. Payments powered by x402 protocol.
