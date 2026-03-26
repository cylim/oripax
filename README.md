# OripaX — On-Chain Gacha on X Layer

OripaX is a Japanese-style Oripa (オリパ / Original Pack) gacha system deployed on X Layer (chain ID 196). Users pay x402 micropayments in USDT to draw cards from finite pools. Cards are minted as ERC-721 NFTs.

## Features

- **Pachinko-style draw UI** — Matter.js physics ball drop, GSAP card reveals, particle explosions for rare pulls
- **x402 micropayments** — Gas-free USDT payments on X Layer via the x402 HTTP protocol
- **Finite pools with shifting odds** — As cards are drawn, remaining odds change in real-time
- **Last One (ラストワン) mechanic** — The final draw from any pool wins a grand prize NFT
- **Keep / Buyback system** — 5-minute window to sell cards back for partial USDT refunds (20–90% by rarity)
- **API-first** — Every feature is an HTTP endpoint. AI agents and bots can draw cards programmatically
- **Admin portal** — Wallet-authenticated admin panel at `/admin` for pool creation, refill, and reset
- **OKX Wallet Connect** — Connect via OKX Universal Connect SDK with dark theme

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19 + SSR) |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite at the edge) |
| ORM | Drizzle ORM |
| Blockchain | X Layer (chain 196) via ethers.js v6 |
| Wallet | OKX Universal Connect SDK |
| Payments | x402 protocol (USDT, gas-free) |
| Styling | Tailwind CSS v4 |
| Animation | GSAP, Matter.js, tsParticles |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI
- Cloudflare account with D1 access
- OKX Developer Portal API keys

### Install

```bash
bun install
```

### Local Development

```bash
# Create local D1 database
npx wrangler d1 create oripax-db
# Update database_id in wrangler.jsonc

# Run migrations
bun run db:migrate:local

# Seed the database
# (start dev server first, then POST to /api/admin/seed)

# Start dev server
bun dev
```

### Deploy

```bash
# Set secrets
wrangler secret put MINTER_PRIVATE_KEY
wrangler secret put OKX_API_KEY
wrangler secret put OKX_SECRET_KEY
wrangler secret put OKX_PASSPHRASE
wrangler secret put ADMIN_SECRET
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_WALLETS       # Comma-separated admin addresses

# Deploy contract to X Layer
bun run contracts:deploy

# Migrate remote D1
bun run db:migrate:remote

# Deploy to Cloudflare Workers
bun run deploy
```

## API

All endpoints return JSON. Draw endpoints require x402 payment.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/oripas | List active oripas |
| GET | /api/oripa/:id | Oripa detail with pool status |
| GET | /api/oripa/:id/pool | Live pool odds |
| GET | /api/draw/:oripaId | Draw a card (x402-gated) |
| POST | /api/draws/decide/:drawId | Keep or buyback a drawn card |
| GET | /api/draws/status/:drawId | Check pending draw status |
| GET | /api/draws/recent | Recent draws |
| GET | /api/draws/user/:addr | User's draw history |
| GET | /api/stats | Global statistics |
| GET | /api/metadata/:cardId | ERC-721 metadata |

### Admin Endpoints (JWT-protected, wallet-authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/admin/auth/challenge | Get sign-in challenge nonce |
| POST | /api/admin/auth/login | Submit signature, receive JWT |
| POST | /api/admin/auth/logout | Clear admin session |
| GET | /api/admin/oripas | List all pools with stats |
| GET | /api/admin/cards | Card catalog for pool creation |
| POST | /api/admin/oripa/create | Create a new pool |
| POST | /api/admin/oripa/:id/refill | Add slots to existing pool |
| POST | /api/admin/oripa/:id/reset | Reset a pool (clear all pulls) |

See [SKILL.md](./SKILL.md) for the full integration guide.

## Architecture

```
User clicks Draw → x402 payment flow → OKX wallet signs USDT transfer
    → Server verifies payment → Core engine draws from pool
    → Card revealed → User has 5 min to Keep or Buyback
    → Keep: ERC-721 minted on X Layer
    → Buyback: USDT refund sent, slot returns to pool

Admin connects wallet → Signs challenge → JWT issued
    → /admin portal: Create pools, refill slots, reset sold-out pools
```

## License

MIT

## Links

- **X Layer**: https://www.oklink.com/xlayer
- **OKX Onchain OS**: https://web3.okx.com/onchainos
- **x402 Protocol**: https://github.com/coinbase/x402
