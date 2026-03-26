# OripaX — Setup & Deploy Guide

Step-by-step instructions to get OripaX running locally and deployed to production.

---

## Prerequisites

- [Bun](https://bun.sh) (package manager & runtime)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`bun add -g wrangler`)
- A Cloudflare account (free tier works)
- An OKX wallet with some OKB on X Layer (for contract deployment gas)
- An [OKX Developer Portal](https://web3.okx.com/onchainos/dev-docs/home/developer-portal) account (for API keys)

---

## Local Development

### 1. Install dependencies

```bash
bun install
cd contracts && bun install && cd ..
```

### 2. Fetch Pokemon card catalog

The card data is already committed in `src/server/card-catalog.json` (1800 cards). To re-fetch or update:

```bash
bun run scripts/fetch-pokemon-cards.ts
```

### 3. Set up local D1 database

If this is your first time (no `.wrangler/` directory yet):

```bash
bun run db:migrate:local
```

This creates a local SQLite D1 database and applies the schema.

### 4. Seed the local database

Start the dev server first, then seed:

```bash
# Terminal 1: start dev server
bun dev

# Terminal 2: seed the database (uses 'dev-secret' in local dev)
curl -X POST http://localhost:5173/api/admin/seed \
  -H "Authorization: Bearer dev-secret"
```

You should see `{"status":"seeded","cards":1800,"oripas":3}`.

If you need to re-seed, delete the local D1 state and re-migrate:

```bash
rm -rf .wrangler/state
bun run db:migrate:local
# Then re-seed via curl
```

### 5. Run the dev server

```bash
bun dev
```

Open http://localhost:3000. You should see:

- The lobby with 3 oripa pools (Starter Box, Premium Collection, Ultra Premium)
- "Connect Wallet" button in the navbar
- Click into any oripa to see the pachinko board and draw button

### 6. Test wallet connection (optional for local dev)

The OKX Connect SDK works on localhost. Click "Connect Wallet" to open the OKX modal. You need the OKX Wallet browser extension or mobile app installed.

---

## Production Deployment

### 7. Create OKX Developer Portal API keys

1. Go to [OKX Developer Portal](https://web3.okx.com/onchainos/dev-docs/home/developer-portal)
2. Create a new project
3. Generate API credentials — you'll get:
   - **API Key** (`OKX_API_KEY`)
   - **Secret Key** (`OKX_SECRET_KEY`)
   - **Passphrase** (`OKX_PASSPHRASE`) — you set this during creation
4. Save these securely; you'll need them in step 10

### 8. Deploy smart contract to X Layer

You need a wallet with OKB on X Layer mainnet for gas (~$0.01 per deploy).

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY npx hardhat run scripts/deploy.ts --config hardhat.config.cjs --network xlayer
```

Save the deployed contract address. Then update it in two places:

```bash
# In wrangler.jsonc — update the CONTRACT_ADDRESS var
# In src/lib/constants.ts — update CONTRACT_ADDRESS
```

### 9. Set up the payment wallet

Choose a wallet address that will receive USDT payments from draws. Update `PAYMENT_WALLET` in `wrangler.jsonc`.

### 10. Verify USDT contract address

The USDT contract on X Layer is set to `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` in `src/lib/constants.ts`.

Verify this is correct on [OKLink X Layer Explorer](https://www.oklink.com/xlayer/token/0x1E4a5963aBFD975d8c9021ce480b42188849D41d) before production use.

### 11. Create remote D1 database

If you haven't created the remote D1 database yet:

```bash
npx wrangler d1 create oripax-db
```

Copy the returned `database_id` into `wrangler.jsonc` (replace the existing one if different).

Then apply migrations to remote:

```bash
bun run db:migrate:remote
```

### 12. Set Wrangler secrets

These are encrypted and never stored in code:

```bash
wrangler secret put MINTER_PRIVATE_KEY    # Private key for the wallet that mints NFTs on X Layer
wrangler secret put OKX_API_KEY           # From step 7
wrangler secret put OKX_SECRET_KEY        # From step 7
wrangler secret put OKX_PASSPHRASE        # From step 7
wrangler secret put ADMIN_SECRET          # Any strong random string (used to auth /api/admin/seed)
wrangler secret put JWT_SECRET            # Random 64+ char hex string (used for admin JWT signing)
wrangler secret put ADMIN_WALLETS         # Comma-separated admin wallet addresses (e.g. "0xabc,0xdef")
```

### 13. Deploy to Cloudflare Workers

```bash
bun run deploy
```

This runs `vite build` then `wrangler deploy`. Note the deployed URL (e.g., `https://oripax.YOUR_SUBDOMAIN.workers.dev`).

### 14. Seed the production database

Replace the URL and secret with your values:

```bash
curl -X POST https://oripax.YOUR_SUBDOMAIN.workers.dev/api/admin/seed \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

Expected response: `{"status":"seeded","cards":1800,"oripas":3}`

### 15. Verify deployment

```bash
# Health check
curl https://oripax.YOUR_SUBDOMAIN.workers.dev/api/health

# Should return 3 oripa pools
curl https://oripax.YOUR_SUBDOMAIN.workers.dev/api/oripas

# Check pool details
curl https://oripax.YOUR_SUBDOMAIN.workers.dev/api/oripa/1
```

Then open the app in a browser:

1. Lobby shows 3 pools (Starter Box $0.01, Premium Collection $0.02, Ultra Premium $0.05)
2. Click "Connect Wallet" — OKX modal appears
3. After connecting, navbar shows your address
4. Navigate to Collection — shows "No cards yet"
5. Refresh — wallet stays connected (session restore)
6. Click into an oripa, click Draw — wallet prompts USDT transfer
7. After approval — pachinko ball drops, card reveals

---

## Updating the Database Schema

If you change `src/server/schema.ts`:

```bash
bun run db:generate              # Generate new migration SQL
bun run db:migrate:local         # Apply locally
bun run db:migrate:remote        # Apply to production
```

---

## Re-fetching Card Data

To refresh the Pokemon card catalog:

```bash
bun run scripts/fetch-pokemon-cards.ts
```

Then re-seed the database (delete existing data first or it will skip due to idempotent guard).

---

## Pool Configuration

Pool prices are defined in `src/lib/constants.ts`:

```typescript
export const POOL_PRICES = {
  STARTER: 0.01, // represents $50 pool
  PREMIUM: 0.02, // represents $200 pool
  ULTRA: 0.05, // represents $500 pool
};
```

Pool sizes and card distributions are in `src/server/seed.ts`. After changing either, re-seed.

Alternatively, use the **Admin Portal** at `/admin` to create new pools with custom configurations without re-seeding.

---

## Environment Variables Reference

### `wrangler.jsonc` vars (public, committed)

| Variable           | Description                        |
| ------------------ | ---------------------------------- |
| `XLAYER_RPC`       | X Layer RPC endpoint               |
| `CONTRACT_ADDRESS` | Deployed OripaX ERC-721 contract   |
| `PAYMENT_WALLET`   | Wallet that receives USDT payments |

### Wrangler secrets (encrypted, NOT committed)

| Secret               | Description                        |
| -------------------- | ---------------------------------- |
| `MINTER_PRIVATE_KEY` | Private key for NFT minting wallet |
| `OKX_API_KEY`        | OKX Developer Portal API key       |
| `OKX_SECRET_KEY`     | OKX Developer Portal secret key    |
| `OKX_PASSPHRASE`     | OKX Developer Portal passphrase    |
| `ADMIN_SECRET`       | Auth token for `/api/admin/seed`   |
| `JWT_SECRET`         | Random hex string for admin JWT signing |
| `ADMIN_WALLETS`      | Comma-separated admin wallet addresses |

### `src/lib/constants.ts` (committed)

| Constant                | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `CONTRACT_ADDRESS`      | Must match wrangler.jsonc                        |
| `USDT_CONTRACT_ADDRESS` | USDT token on X Layer — verify before production |
| `POOL_PRICES`           | Draw prices in USDT per pool tier                |

---

## Admin Portal

The admin portal at `/admin` provides a web UI for pool management. Only whitelisted wallet addresses can access it.

### Setup

1. Set the `ADMIN_WALLETS` secret to a comma-separated list of admin wallet addresses:

```bash
wrangler secret put ADMIN_WALLETS
# Enter: 0xYourAddress,0xAnotherAdmin
```

2. Set the `JWT_SECRET` used for signing admin session tokens:

```bash
wrangler secret put JWT_SECRET
# Enter a random 64+ character hex string
```

For local dev, set these in `wrangler.jsonc` under `vars`:

```jsonc
"ADMIN_WALLETS": "0xYourLocalDevAddress",
"JWT_SECRET": "dev-jwt-secret-change-me"
```

### Usage

1. Navigate to `/admin`
2. Connect your OKX wallet
3. Click "Sign to Authenticate" — your wallet will prompt you to sign a challenge message
4. After signing, you'll see the admin dashboard

### Features

- **Dashboard** — View all pools (active and sold-out) with stats: remaining slots, revenue, pending draws
- **Create Pool** — Create new pools with custom name, price, slot count, rarity distribution, and Last One prize
- **Refill Pool** — Add new slots to an existing pool (reactivates sold-out pools)
- **Reset Pool** — Clear all pulls from a pool and re-shuffle card assignments. Blocks if there are pending draws unless force mode is used

### Auth Flow

```
Admin connects wallet → POST /api/admin/auth/challenge (get nonce)
    → Wallet signs challenge via personal_sign
    → POST /api/admin/auth/login (submit signature)
    → Server recovers address via EIP-191, checks ADMIN_WALLETS
    → Issues HS256 JWT (24h expiry) as HttpOnly cookie
    → All admin endpoints validate JWT on each request
```

---

## Competition Submission Checklist (X Layer Developer Challenge)

- [ ] Contract deployed on X Layer (chain 196) — save deploy tx hash
- [ ] At least 1 on-chain transaction (mint) — save tx hash
- [ ] x402 payment protocol integrated in `/api/draw` endpoint
- [ ] OKX Onchain OS APIs used (Wallet Connect, Payment/x402)
- [ ] GitHub repo is public with README and SKILL.md
- [ ] Create project X/Twitter account
- [ ] Record 2-min demo video: lobby → pick oripa → pay → pachinko ball drop → card reveal → Last One → explorer proof
- [ ] Reply to @XLayerOfficial announcement thread
- [ ] Complete registration form
