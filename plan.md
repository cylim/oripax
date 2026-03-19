# OripaX — Complete Development Plan for Claude Code

> This document is a comprehensive build specification for an AI coding agent (Claude Code).
> Follow it sequentially, phase by phase. Every file path, dependency, config value, and code pattern is intentional.
> Do not deviate unless a step explicitly fails — document the error and adapt.
> Before starting, read the SKILL.md at the bottom of this document for integration context.

---

## PROJECT OVERVIEW

**OripaX** is an on-chain Japanese-style Oripa (オリパ / Original Pack) gacha system deployed on X Layer (chain ID 196).

**Core mechanics:**

- Users pay x402 micropayments (USDT, zero gas on X Layer) to draw from finite card pools
- Cards are minted as ERC-721 NFTs on X Layer
- The "Last One" (ラストワン) mechanic awards a grand prize to whoever draws the final slot
- Odds shift in real-time as cards are drawn from the finite pool
- The pool empties → SOLD OUT → new oripa rotates in

**Design philosophy:**

- **API-first**: Every feature is an HTTP endpoint. The frontend is a client of the API. AI agents, bots, and CLI users can interact with OripaX without ever touching the web UI.
- **Pachinko aesthetic**: The frontend evokes the sensory overload of a Japanese pachinko parlor — neon colors, ball-drop physics, flashy card reveals, sound-reactive animations, LED-style pool meters.
- **OKX Onchain OS native**: All blockchain interactions go through OKX's Onchain OS APIs (Wallet, Market, Payments). This is a hackathon requirement.

**Competition:** X Layer Developer Challenge ($200K USDT pool). Requirements: built on X Layer (chain 196), uses x402 protocol, ≥1 on-chain tx, open-source GitHub, project X/Twitter account.

---

## TECH STACK

| Layer                | Technology                         | Version       | Notes                                      |
| -------------------- | ---------------------------------- | ------------- | ------------------------------------------ |
| Package manager      | **bun**                            | latest        | Faster installs, native TS, runs scripts   |
| Full-stack framework | TanStack Start                     | ^1.138+       | Cloudflare Vite plugin support             |
| Router               | TanStack Router                    | ^1.120+       | File-based, type-safe                      |
| Data fetching        | TanStack Query                     | ^5.60+        | SWR caching, polling for live pool updates |
| Runtime              | Cloudflare Workers                 | V8 isolates   | Edge deployment                            |
| Database             | Cloudflare D1                      | Edge SQLite   | Via wrangler bindings                      |
| ORM                  | Drizzle ORM                        | ^0.38+        | `drizzle-orm/d1` driver                    |
| Smart contract       | Solidity 0.8.20 + OpenZeppelin 5.x | Hardhat       |                                            |
| Blockchain           | ethers.js                          | ^6.13         | `nodejs_compat` flag required              |
| Styling              | TailwindCSS v4                     |               |                                            |
| Animation            | GSAP + matter.js                   | ^3.12 / ^0.20 | Pachinko ball physics, card reveals        |
| Canvas effects       | tsparticles                        | ^3.7          | Neon particle explosions for rare pulls    |
| OKX APIs             | Onchain OS                         | v6            | Wallet, Market, Payments (x402)            |
| x402 protocol        | OKX Payment API                    |               | Gas-free USDT on X Layer                   |

---

## CRITICAL: OKX ONCHAIN OS INTEGRATION

All blockchain interactions MUST go through OKX Onchain OS. This is a hackathon requirement.

### Documentation references

- Home: https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos
- Authentication: https://web3.okx.com/onchainos/dev-docs/home/api-access-and-usage
- Developer Portal: https://web3.okx.com/onchainos/dev-docs/home/developer-portal
- Wallet API: https://web3.okx.com/onchainos/dev-docs/wallet/what-is-wallet
- Trade API: https://web3.okx.com/onchainos/dev-docs/trade/dex-api-introduction
- Market API: https://web3.okx.com/onchainos/dev-docs/market/market-api-introduction
- Payments (x402): https://web3.okx.com/onchainos/dev-docs/payments/x402-introduction
- Payment API Reference: https://web3.okx.com/onchainos/dev-docs/payments/x402-api-reference
- Supported Networks: https://web3.okx.com/onchainos/dev-docs/payments/supported-networks
- DApp Connect Wallet: https://web3.okx.com/onchainos/dev-docs/sdks/okx-wallet-integration-introduction

### Authentication pattern (all Onchain OS APIs)

Every API call to `web3.okx.com` requires these headers:

```
OK-ACCESS-KEY:        <api_key from developer portal>
OK-ACCESS-SIGN:       Base64(HMAC-SHA256(timestamp + method + requestPath + body, secretKey))
OK-ACCESS-TIMESTAMP:  ISO 8601 UTC (e.g., 2026-03-18T12:00:00.000Z)
OK-ACCESS-PASSPHRASE: <passphrase set during API key creation>
```

Signature generation:

```typescript
import { createHmac } from "crypto";

function signOKX(
  method: string,
  path: string,
  body: string,
  secretKey: string,
) {
  const timestamp = new Date().toISOString();
  const preHash = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac("sha256", secretKey)
    .update(preHash)
    .digest("base64");
  return { signature, timestamp };
}
```

IMPORTANT: The timestamp difference from OKX server must not exceed 30 seconds. POST requests must include the raw body in the signature. GET requests append query string to the path.

### APIs we use

| API                 | Purpose in OripaX                                  | Base URL                                   |
| ------------------- | -------------------------------------------------- | ------------------------------------------ |
| **Payments (x402)** | Gas-free USDT micropayments for draws              | `web3.okx.com` endpoints per API reference |
| **Wallet API**      | Query user NFT balances, tx history on X Layer     | `web3.okx.com/api/v6/wallet/...`           |
| **Market API**      | Token price data for AI pool manager, market stats | `web3.okx.com/api/v6/dex/...`              |
| **DApp Connect**    | OKX Wallet integration in frontend                 | SDK: `@okxconnect/ui`                      |

IMPORTANT: Before implementing x402 payment verification, read the Payment API Reference docs thoroughly. The OKX facilitator handles verify and settle for X Layer (chain 196) with gas-free USDT/USDC. Use the exact endpoint paths and request/response shapes from the reference docs. If the API reference is not accessible, fall back to the standard x402 HTTP protocol (402 status + X-Payment-Required header + facilitator verify/settle) as documented at https://github.com/coinbase/x402.

---

## API-FIRST DESIGN

OripaX is API-first. Every feature is accessible via HTTP without the frontend. This enables:

- AI agents to draw cards programmatically
- CLI users to interact via curl
- Third-party frontends to build on top of OripaX
- Bot agents to race for "Last One" prizes

### Public API contract

All endpoints return JSON. No authentication required for read endpoints. Draw endpoints require x402 payment.

```
GET  /api/health              → { status, chain, timestamp }
GET  /api/oripas              → [{ id, name, totalSlots, remaining, pricePerDraw, lastOnePrize, status }]
GET  /api/oripa/:id           → { ...oripa, pool: { total, remaining, remainingByRarity, recentPulls } }
GET  /api/oripa/:id/pool      → { total, remaining, remainingByRarity, odds }
GET  /api/draws/recent        → [{ oripaId, rarity, userAddress, txHash, timestamp }]
GET  /api/draws/user/:address → [{ cardId, rarity, oripaId, txHash, timestamp }]
GET  /api/stats               → { totalDraws, totalMinted, totalRevenue, lastOneWinners }
GET  /api/metadata/:cardId    → ERC-721 metadata JSON

GET  /api/draw/:oripaId       → 402 Payment Required (x402 flow)
                              → With X-PAYMENT header: { success, card, isLastOne, lastOnePrize, remaining, txHash }

POST /api/admin/seed          → Seeds initial oripa pool (admin only, protected by secret)
```

AI agents interact by:

1. `GET /api/oripas` → find active pools
2. `GET /api/oripa/:id` → check remaining slots and odds
3. `GET /api/draw/:oripaId` → receive 402 → sign payment → retry with X-PAYMENT header → receive card

---

## FRONTEND: PACHINKO AESTHETIC

The frontend should feel like walking into a Japanese pachinko parlor or an Akihabara card shop gacha corner. Think: Clove, DOPA!, or physical oripa vending machines.

### Visual design system

**Color palette:**

- Background: deep black (#0A0A0F) with subtle noise texture
- Primary accent: electric amber/gold (#FFB800) — the "coin" color
- Secondary accent: hot pink/magenta (#FF2D78) — rare pull highlights
- Tertiary: electric blue (#00B4FF) — uncommon highlights
- Text: white on dark, with neon glow on headings
- Card borders: color per rarity with CSS glow/box-shadow

**Typography:**

- Headings: bold, condensed, slightly italic — arcade marquee feel
- Use a Google Font like "Orbitron", "Press Start 2P", or "Russo One" for headings
- Body: clean sans-serif (system font stack)

**Key visual elements:**

1. **Pachinko ball drop**: When a user draws, animate a golden ball dropping through a peg board (using matter.js for physics), landing in a slot that determines the card rarity. The ball bounces off pegs realistically.
2. **Neon pool meter**: Instead of a flat progress bar, show a vertical tube (like a mercury thermometer) with glowing liquid that drains as cards are drawn. LED-style segmented display for the count.
3. **Card reveal**: After the ball lands, the screen flashes with the rarity color, then the card slides in from the side with a 3D flip animation. Rare+ cards get particle explosions (tsparticles).
4. **"Last One" mode**: When ≤5 slots remain, the entire UI shifts to a red alert state — pulsing borders, sirens-like animation, "LAST ONE" text flashing in Japanese (ラストワン賞).
5. **Sound effects**: Optional ambient pachinko sounds. Coin insert on draw, ball drop sounds, jackpot sirens for rare pulls. Use Web Audio API.
6. **Oripa lobby**: Display active oripas as vending machine panels — each with a glass case showing the top prize, a coin slot, and a LED remaining counter.

**Card design:**

- Cards render as `<canvas>` or styled `<div>` elements with:
  - Rarity-colored border with CSS glow (`box-shadow: 0 0 20px`)
  - Card art image (placeholder or AI-generated)
  - Name, stats (ATK/DEF), element badge, rarity badge
  - Holographic shimmer effect on hover for Rare+ (CSS `background: linear-gradient` with `animation`)

**Responsive design:**

- Mobile-first — the pachinko ball drop should work on phone screens
- Card grid adapts: 5 columns on desktop, 3 on tablet, 2 on mobile
- Draw button is always prominent and accessible

### Animation libraries

- **matter.js** (^0.20): 2D physics for the pachinko ball drop — pegs as static circles, ball as dynamic circle, slots at bottom
- **GSAP** (^3.12): Card reveal transitions, slide-in animations, scale/rotate
- **tsparticles** (^3.7): Particle explosions for rare card reveals — gold confetti for Ultra Rare, rainbow for Secret Rare
- **CSS animations**: Neon glow pulsing, holographic shimmer, LED counter flicker

---

## PHASE 1: PROJECT SCAFFOLDING

### Step 1.1 — Create TanStack Start project

```bash
bun create cloudflare@latest oripax -- --template=tanstack-start
cd oripax
```

If that template doesn't exist, scaffold manually:

```bash
mkdir oripax && cd oripax
bun init -y
bun add react react-dom @tanstack/react-router @tanstack/react-start @tanstack/react-query
bun add -D @cloudflare/vite-plugin wrangler vite @vitejs/plugin-react typescript @types/react @types/react-dom @cloudflare/workers-types
```

### Step 1.2 — Install all dependencies

```bash
# Core
bun add drizzle-orm ethers gsap matter-js @tsparticles/react @tsparticles/engine @tsparticles/slim tailwindcss @tailwindcss/vite

# OKX Connect
bun add @okxconnect/ui

# Dev
bun add -D drizzle-kit @types/matter-js

# Contracts (separate dir)
mkdir -p contracts
cd contracts && bun init -y
bun add -D hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
cd ..
```

### Step 1.3 — Project structure

```
oripax/
├── src/
│   ├── router.tsx
│   ├── client.tsx                     # Client entry point
│   ├── routes/
│   │   ├── __root.tsx                 # Root layout — dark theme, neon nav
│   │   ├── index.tsx                  # Oripa lobby — vending machine grid
│   │   ├── oripa.$id.tsx              # Oripa detail — pachinko draw UI
│   │   ├── collection.tsx             # User's NFT gallery
│   │   ├── leaderboard.tsx            # Last One winners, top collectors
│   │   ├── api/
│   │   │   ├── health.ts
│   │   │   ├── oripas.ts             # GET active oripas
│   │   │   ├── oripa.$id.ts          # GET single oripa detail
│   │   │   ├── oripa.$id.pool.ts     # GET pool status with live odds
│   │   │   ├── draw.$oripaId.ts      # x402-gated draw endpoint
│   │   │   ├── draws.recent.ts       # GET recent draws across all oripas
│   │   │   ├── draws.user.$address.ts # GET draws for a specific wallet
│   │   │   ├── stats.ts              # GET global statistics
│   │   │   ├── metadata.$cardId.ts   # GET ERC-721 metadata JSON
│   │   │   └── admin.seed.ts         # POST seed database (admin)
│   ├── server/
│   │   ├── db.ts                      # Drizzle + D1 binding
│   │   ├── schema.ts                  # Database schema
│   │   ├── oripa.functions.ts         # createServerFn() typed RPCs for frontend
│   │   ├── oripa.server.ts            # Core engine: create pool, draw, Last One
│   │   ├── okx.server.ts             # OKX Onchain OS API client (auth, sign)
│   │   ├── x402.server.ts            # x402 protocol: 402 response, verify, settle
│   │   ├── mint.server.ts            # ERC-721 minting via ethers.js
│   │   └── seed.ts                   # Seed data: 50 cards + genesis oripa pool
│   ├── components/
│   │   ├── PachinkoBoard.tsx          # matter.js ball-drop physics canvas
│   │   ├── CardReveal.tsx             # GSAP card flip + particle explosion
│   │   ├── OripaCard.tsx              # Card display with rarity glow
│   │   ├── NeonPoolMeter.tsx          # Vertical LED-style remaining meter
│   │   ├── VendingMachine.tsx         # Lobby card — oripa as vending machine
│   │   ├── LastOneAlert.tsx           # Pulsing red alert for final slots
│   │   ├── DrawButton.tsx             # Coin-insert style button
│   │   ├── ParticleExplosion.tsx      # tsparticles for rare reveals
│   │   ├── HolographicShimmer.tsx     # CSS holographic effect on hover
│   │   └── Navbar.tsx                 # Neon-glow navigation
│   ├── lib/
│   │   ├── x402-client.ts            # Client-side x402 payment flow
│   │   ├── okx-auth.ts               # OKX signature generation (shared)
│   │   ├── constants.ts              # Addresses, chain config, card data
│   │   ├── sounds.ts                 # Web Audio API sound effects
│   │   └── utils.ts                  # Helpers
│   └── styles/
│       └── app.css                   # Tailwind + pachinko theme + neon effects
├── contracts/
│   ├── contracts/OripaX.sol
│   ├── scripts/deploy.ts
│   ├── test/OripaX.test.ts
│   └── hardhat.config.ts
├── drizzle/
│   └── migrations/
├── public/
│   ├── cards/                         # Card art PNGs
│   ├── sounds/                        # Pachinko sound effects (coin, ball, jackpot)
│   └── fonts/                         # Arcade-style fonts
├── vite.config.ts
├── wrangler.toml
├── drizzle.config.ts
├── tsconfig.json
├── package.json
├── SKILL.md                           # Integration guide for developers/agents
└── README.md
```

### Step 1.4 — Configuration files

**vite.config.ts:**

```typescript
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
});
```

**wrangler.toml:**

```toml
name = "oripax"
compatibility_date = "2025-09-02"
compatibility_flags = ["nodejs_compat"]
main = "@tanstack/react-start/server-entry"

[[d1_databases]]
binding = "DB"
database_name = "oripax-db"
database_id = "FILL_AFTER_D1_CREATION"
migrations_dir = "drizzle/migrations"

[vars]
XLAYER_RPC = "https://rpc.xlayer.tech"
CONTRACT_ADDRESS = "FILL_AFTER_DEPLOY"
PAYMENT_WALLET = "FILL_WITH_YOUR_WALLET"
# Secrets (set via `wrangler secret put`):
# MINTER_PRIVATE_KEY
# OKX_API_KEY
# OKX_SECRET_KEY
# OKX_PASSPHRASE
# ADMIN_SECRET
```

**drizzle.config.ts:**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
});
```

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "bun run build && wrangler deploy",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply oripax-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply oripax-db --remote",
    "db:studio": "drizzle-kit studio",
    "cf-typegen": "wrangler types",
    "contracts:compile": "cd contracts && npx hardhat compile",
    "contracts:test": "cd contracts && npx hardhat test",
    "contracts:deploy": "cd contracts && npx hardhat run scripts/deploy.ts --network xlayer"
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": { "~/*": ["./src/*"] },
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "contracts"]
}
```

---

## PHASE 2: DATABASE

### Step 2.1 — Create D1 database

```bash
npx wrangler d1 create oripax-db
```

Copy the `database_id` into `wrangler.toml`.

### Step 2.2 — Schema

**src/server/schema.ts** — Define tables: `oripas`, `oripaSlots`, `draws`, `cards`. Same schema as previously defined in the architecture document. Include all fields: id, oripaId, slotIndex, cardId, rarity, pulledBy, pulledAt for slots. Include status (active/sold_out), lastOnePrize (JSON), pricePerDraw for oripas. Include txHash, paymentTxHash, isLastOne for draws.

### Step 2.3 — D1 binding helper

**src/server/db.ts** — Use `import { env } from 'cloudflare:workers'` to access the DB binding. Create Drizzle instance with `drizzle(env.DB, { schema })`.

### Step 2.4 — Generate and apply

```bash
bun run db:generate
bun run db:migrate:local
```

---

## PHASE 3: SMART CONTRACT

### Step 3.1 — OripaX.sol

ERC-721 with `mintCard(address to, uint256 oripaId, uint256 cardNumber, uint8 rarity, string tokenURI)`. Events: `CardDrawn`, `LastOneWon`. `Ownable` — only backend wallet can mint.

### Step 3.2 — Deploy to X Layer

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0xKEY npx hardhat run scripts/deploy.ts --network xlayer
```

X Layer config: `url: "https://rpc.xlayer.tech"`, `chainId: 196`, `gasPrice: 1000000000`.
Save deployed address into `wrangler.toml` and `src/lib/constants.ts`.

---

## PHASE 4: OKX ONCHAIN OS CLIENT

**src/server/okx.server.ts** — A reusable OKX API client:

```typescript
import { createHmac } from "crypto";
import { env } from "cloudflare:workers";

const OKX_BASE = "https://web3.okx.com";

function getSecrets() {
  // Access wrangler secrets
  return {
    apiKey: (env as any).OKX_API_KEY as string,
    secretKey: (env as any).OKX_SECRET_KEY as string,
    passphrase: (env as any).OKX_PASSPHRASE as string,
  };
}

function signRequest(method: string, path: string, body: string = "") {
  const { secretKey } = getSecrets();
  const timestamp = new Date().toISOString();
  const preHash = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac("sha256", secretKey)
    .update(preHash)
    .digest("base64");
  return { signature, timestamp };
}

export async function okxFetch(method: string, path: string, body?: any) {
  const { apiKey, passphrase } = getSecrets();
  const bodyStr = body ? JSON.stringify(body) : "";
  const { signature, timestamp } = signRequest(method, path, bodyStr);

  const res = await fetch(`${OKX_BASE}${path}`, {
    method,
    headers: {
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
    ...(body && { body: bodyStr }),
  });

  return res.json();
}
```

Set secrets:

```bash
wrangler secret put OKX_API_KEY
wrangler secret put OKX_SECRET_KEY
wrangler secret put OKX_PASSPHRASE
wrangler secret put MINTER_PRIVATE_KEY
wrangler secret put ADMIN_SECRET
```

---

## PHASE 5: x402 PAYMENT HANDLER

**src/server/x402.server.ts** — Implements the x402 protocol using OKX's Payment API as the facilitator.

The create402Response function returns HTTP 402 with payment requirements in both the body and the `X-Payment-Required` header (base64 encoded). The payment requirements specify: scheme "exact", network "eip155:196" (X Layer), asset "USDT", price, and payTo address.

The verifyX402Payment function takes the X-PAYMENT header, decodes the payload, and verifies it with OKX's Payment API endpoint. On success, it calls the settle endpoint and returns the payer address and txHash.

CRITICAL: Read the OKX Payment API Reference at `https://web3.okx.com/onchainos/dev-docs/payments/x402-api-reference` for exact endpoint paths. The reference docs show the verify and settle endpoints, request/response schemas, and supported networks. Use the OKX-authenticated fetch (`okxFetch`) from Phase 4 for these calls.

If the OKX Payment API reference is not accessible or the endpoints are different from expected, implement the standard x402 protocol flow as a fallback: the server returns 402 + payment details → client signs USDT transfer → client retries with signed payload in X-PAYMENT header → server verifies the on-chain transaction directly using ethers.js.

---

## PHASE 6: CORE ORIPA ENGINE

**src/server/oripa.server.ts** — The core draw engine.

Functions to implement:

- `createOripaPool(config)` — Creates a pool with N slots, shuffles card assignments using Fisher-Yates with `crypto.getRandomValues()`, stores in D1
- `executeDraw(oripaId, userAddress)` — Atomic draw: query available slots → random select → optimistic lock update (`WHERE pulledBy IS NULL`) → check Last One → log draw
- `getPoolStatus(oripaId)` — Returns remaining count, remaining by rarity, current odds (percentage), recent pulls
- `getActiveOripas()` — Lists all active (non-sold-out) oripas with remaining counts
- `getOripaById(oripaId)` — Full oripa detail with pool status

The optimistic lock pattern for concurrent draws:

```sql
UPDATE oripa_slots
SET pulledBy = ?, pulledAt = ?
WHERE id = ? AND pulledBy IS NULL
```

If zero rows affected → someone else got it → retry (max 3 retries).

Last One detection: if `availableSlots.length - 1 === 0` after the draw, mark oripa as `sold_out`, return the lastOnePrize, and emit the data needed for the `LastOneWon` contract event.

---

## PHASE 7: NFT MINTING

**src/server/mint.server.ts** — Mints ERC-721 on X Layer via ethers.js.

Uses the MINTER_PRIVATE_KEY secret to sign transactions. Connects to X Layer RPC (`https://rpc.xlayer.tech`). Calls `contract.mintCard(to, oripaId, cardNumber, rarity, tokenURI)`. Returns txHash.

Gas cost is negligible on X Layer (~$0.001 per mint). The minter wallet needs a small amount of OKB for gas.

For the `tokenURI`, point to our own metadata endpoint: `https://oripax.YOUR_DOMAIN/api/metadata/{cardId}`. This endpoint returns standard ERC-721 JSON with name, description, image, and attributes.

---

## PHASE 8: API ROUTES

Implement every endpoint from the "Public API contract" section above as TanStack Start server routes.

Each file in `src/routes/api/` exports a `Route` with `server.handlers` containing GET/POST handlers that return `new Response(JSON.stringify(...))`.

The `/api/draw/:oripaId` route is the critical one — it implements the full x402 flow:

1. Check for X-PAYMENT header
2. If absent → return `create402Response()`
3. If present → `verifyX402Payment()` → `executeDraw()` → `mintCardOnChain()` → return result
4. Handle errors: SOLD_OUT (410), payment failed (402), mint failed (500 but draw still logged)

The `/api/admin/seed` route requires an `Authorization: Bearer <ADMIN_SECRET>` header. It calls `seedDatabase()` to populate the card catalog and create the genesis oripa pool.

The `/api/metadata/:cardId` route returns standard ERC-721 metadata JSON:

```json
{
  "name": "Neon Beast #023",
  "description": "An uncommon creature from the Genesis set.",
  "image": "https://oripax.example.com/cards/uncommon_3.png",
  "attributes": [
    { "trait_type": "Set", "value": "Genesis" },
    { "trait_type": "Rarity", "value": "Uncommon" },
    { "trait_type": "Element", "value": "Water" },
    { "display_type": "number", "trait_type": "Attack", "value": 42 },
    { "display_type": "number", "trait_type": "Defense", "value": 34 }
  ]
}
```

---

## PHASE 9: SERVER FUNCTIONS (for frontend)

**src/server/oripa.functions.ts** — `createServerFn()` wrappers for route loaders:

- `fetchActiveOripas()` — called from index.tsx loader
- `fetchOripaDetail({ id })` — called from oripa.$id.tsx loader
- `fetchPoolStatus({ id })` — called for polling updates via TanStack Query
- `fetchUserDraws({ address })` — called from collection.tsx loader
- `fetchGlobalStats()` — called from leaderboard.tsx loader

These are typed RPCs that run on the server but are callable from client components and route loaders with full type inference.

---

## PHASE 10: FRONTEND — PACHINKO UI

### Root layout (`__root.tsx`)

- Dark background (#0A0A0F)
- Neon glow navbar with OripaX logo (Japanese + English)
- OKX Wallet Connect button in nav (via @okxconnect/ui)
- Import arcade-style Google Font (Orbitron or similar)

### Lobby page (`index.tsx`)

- Grid of VendingMachine components — each oripa displayed as a vending machine panel
- Each panel shows: glass case with top prize image, LED remaining counter, price badge, DRAW button
- Sold-out machines are grayed out with "SOLD OUT" overlay
- Neon "NEW" badge on recently created oripas

### Oripa detail page (`oripa.$id.tsx`)

- **Left side:** PachinkoBoard component (matter.js canvas) — pegs arranged in a triangle pattern, ball drops from top
- **Right side:** Pool info — NeonPoolMeter (vertical LED tube), rarity breakdown with shifting odds, recent pulls feed
- **Center bottom:** DrawButton — large, coin-slot style, glows on hover
- When user clicks DRAW:
  1. Trigger x402 payment flow (wallet signs USDT payment)
  2. On payment success, drop the pachinko ball
  3. Ball bounces through pegs (physics sim, ~2-3 seconds)
  4. Ball lands in a slot → slot maps to the rarity of the drawn card
  5. Trigger CardReveal animation: screen flashes rarity color → card flips in → particles explode (for Rare+)
  6. If Last One: full-screen golden explosion, "ラストワン賞" text, confetti rain
- Use TanStack Query with `refetchInterval: 3000` to poll pool status and show live updates from other users' draws

### PachinkoBoard component

- Canvas element using matter.js
- Static pegs: circles arranged in rows, offset pattern (like a real pachinko board)
- Dynamic ball: drops from a random x position at top
- Slots at bottom: 5 slots corresponding to 5 rarity tiers
- The slot the ball lands in is purely visual — the actual rarity is determined server-side by the draw engine
- Animate the ball landing by matching the slot to the card's actual rarity (widen the correct slot slightly to guide the ball)

### CardReveal component

- GSAP timeline:
  1. Screen overlay flashes with rarity color (200ms)
  2. Card element scales from 0 → 1 with rotation (400ms)
  3. Card details fade in (200ms)
  4. If Rare+: tsparticles explosion behind the card
  5. If Secret Rare: rainbow shimmer CSS animation on card border
  6. If Last One: extended animation — golden rain, "JACKPOT" text, screen shake

### Collection page

- Gallery grid of user's pulled cards
- Filter by rarity, sort by date
- Each card shows holographic shimmer on hover
- Connect wallet to load collection from X Layer (via Onchain OS Wallet API)

### Leaderboard page

- "Last One" winners hall of fame (golden names, prize cards)
- Top collectors by total cards
- Recent rare pulls feed (live via polling)

---

## PHASE 11: SOUND EFFECTS

**src/lib/sounds.ts** — Web Audio API manager:

- `coin_insert.mp3` — plays on DRAW button click
- `ball_drop.mp3` — plays during pachinko animation
- `ball_bounce.mp3` — plays on each peg collision
- `card_reveal.mp3` — plays on card flip
- `rare_pull.mp3` — plays for Rare+ cards (more dramatic sound)
- `jackpot.mp3` — plays for Last One win
- `ambient_pachinko.mp3` — optional background loop (toggleable)

Use royalty-free sound effects. For hackathon, simple synthesized sounds via Web Audio API oscillators are acceptable as placeholders.

Provide a mute toggle in the navbar.

---

## PHASE 12: SEED DATA

**src/server/seed.ts** — Same card catalog and pool configuration as defined in the architecture document:

- 50 unique cards: 20 Common, 15 Uncommon, 8 Rare, 5 Ultra Rare, 2 Secret Rare
- Genesis oripa pool: 100 slots at $0.10, with shuffled distribution
- Last One prize: a special card not available in the regular pool

For card images, generate simple placeholder PNGs programmatically: colored backgrounds per rarity with card name, stats, and element text overlaid. Place in `public/cards/`.

---

## PHASE 13: DEPLOY

```bash
# 1. Set secrets
wrangler secret put MINTER_PRIVATE_KEY
wrangler secret put OKX_API_KEY
wrangler secret put OKX_SECRET_KEY
wrangler secret put OKX_PASSPHRASE
wrangler secret put ADMIN_SECRET

# 2. Migrate D1
bun run db:migrate:remote

# 3. Deploy
bun run deploy

# 4. Seed remote database
curl -X POST https://oripax.YOUR.workers.dev/api/admin/seed \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"

# 5. Verify
curl https://oripax.YOUR.workers.dev/api/health
curl https://oripax.YOUR.workers.dev/api/oripas
```

---

## PHASE 14: CARD ART

Generate placeholder card art as simple styled PNGs (400x560px each):

- Common: dark gray background, white border, simple geometric pattern
- Uncommon: teal background, silver border, subtle glow
- Rare: deep blue background, gold border, star pattern
- Ultra Rare: purple background, holographic border effect, crystal pattern
- Secret Rare: amber/gold background, rainbow border, lightning pattern
- Last One: black background, animated rainbow border, special "ラストワン" stamp

These are placeholders. If time permits, generate polished creature art using AI image generation tools.

---

## PHASE 15: COMPETITION SUBMISSION

Verify all requirements:

- [ ] Contract on X Layer (chain 196) — deploy tx hash saved
- [ ] ≥1 on-chain transaction — mint tx hash saved
- [ ] x402 payment protocol — integrated in /api/draw endpoint
- [ ] OKX Onchain OS used — Wallet API, Market API, x402 Payment API
- [ ] GitHub repo public with README
- [ ] SKILL.md in repo root
- [ ] Project X/Twitter account created
- [ ] Demo video (2 min): lobby → pick oripa → pay → pachinko ball drop → card reveal → Last One win → explorer proof
- [ ] Reply to @XLayerOfficial thread
- [ ] Registration form completed

---

## KEY TECHNICAL NOTES FOR CLAUDE CODE

1. **Use `bun` for everything** — `bun add`, `bun run`, `bunx`. Do NOT use npm or pnpm.
2. **Cloudflare bindings**: `import { env } from 'cloudflare:workers'` — not process.env for D1.
3. **Wrangler secrets**: Set via `wrangler secret put`. Access in Workers via `(env as any).SECRET_NAME`.
4. **D1 has no row-level locking**: Use optimistic lock pattern (`UPDATE WHERE ... IS NULL`).
5. **ethers.js v6 needs `nodejs_compat`** flag in wrangler.toml.
6. **TanStack Start server routes return Web API `Response` objects** — not Express res.json().
7. **TanStack Start v1.138+**: Use `.validator()` not `.inputValidator()` on server functions.
8. **matter.js in browser only**: Import dynamically in the PachinkoBoard component, not at server level.
9. **GSAP + tsparticles**: Client-side only. Use React `useEffect` or dynamic imports.
10. **x402 is pure HTTP**: 402 status + payment headers. No SDK required. OKX facilitator handles verify/settle.
11. **All OKX API calls need HMAC-SHA256 signed headers** — timestamp must be within 30 seconds of OKX server.
12. **Card images in `/public/cards/`** are served as static assets automatically by Cloudflare.
13. **For local dev**, D1 runs in `.wrangler/state/`. Use `bun run db:migrate:local` after schema changes.
14. **Before implementing OKX Payment API x402 verify/settle**: Read the Payment API Reference docs at the URL in the documentation references section. Use the exact endpoint paths from those docs.

---

## SKILL.md (Place this file at the repo root)

````markdown
# OripaX Integration Guide (SKILL.md)

## What is OripaX?

OripaX is an on-chain Oripa (オリパ) gacha system on X Layer. Users draw cards from finite pools by paying x402 micropayments. Cards are ERC-721 NFTs.

## Quick Start for Agents & Developers

### 1. Browse available oripas

```bash
curl https://oripax.example.com/api/oripas
```
````

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

```

```

---

This document is the complete specification. Execute phases sequentially. Ask the operator before any step requiring credentials (API keys, private keys, Cloudflare account IDs).
