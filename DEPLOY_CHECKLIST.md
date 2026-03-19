# OripaX — Manual Steps Checklist

Everything below requires credentials, accounts, or human action that can't be automated by Claude Code.

---

## 1. Create Cloudflare D1 Database

```bash
npx wrangler d1 create oripax-db
```

Copy the returned `database_id` into `wrangler.jsonc` (replace `"placeholder-update-after-d1-create"`).

Then run migrations:

```bash
bun run db:migrate:local    # for local dev
bun run db:migrate:remote   # for production
```

---

## 2. Deploy Smart Contract to X Layer

You need a funded wallet with some OKB on X Layer for gas.

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0xYOUR_KEY npx hardhat run scripts/deploy.ts --network xlayer
```

After deployment, update these files with the deployed address:
- `wrangler.jsonc` → `CONTRACT_ADDRESS`
- `src/lib/constants.ts` → `CONTRACT_ADDRESS`

---

## 3. Set Wrangler Secrets

```bash
wrangler secret put MINTER_PRIVATE_KEY    # Private key for the wallet that mints NFTs
wrangler secret put OKX_API_KEY           # From OKX Developer Portal
wrangler secret put OKX_SECRET_KEY        # From OKX Developer Portal
wrangler secret put OKX_PASSPHRASE        # Set during API key creation
wrangler secret put ADMIN_SECRET          # Any strong secret for /api/admin/seed
```

---

## 4. Set Payment Wallet

Update `PAYMENT_WALLET` in `wrangler.jsonc` with the wallet address that receives USDT draw payments.

---

## 5. Verify USDT Contract Address

The USDT contract address on X Layer is currently set to `0x1E4a5963aBFD975d8c9021ce480b42188849D41d` in `src/lib/constants.ts`. Verify this is correct on [OKLink X Layer Explorer](https://www.oklink.com/xlayer) before going to production.

---

## 6. Deploy to Cloudflare Workers

```bash
bun run build
bun run deploy
```

---

## 7. Seed Production Database

```bash
curl -X POST https://YOUR_WORKER.workers.dev/api/admin/seed \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

---

## 8. Verify Deployment

```bash
curl https://YOUR_WORKER.workers.dev/api/health
curl https://YOUR_WORKER.workers.dev/api/oripas
```

Open the app in browser, connect wallet, try a draw.

---

## 9. Competition Submission (X Layer Developer Challenge)

- [ ] Contract deployed on X Layer (chain 196) — save deploy tx hash
- [ ] At least 1 on-chain transaction (mint) — save tx hash
- [ ] x402 payment protocol integrated in /api/draw endpoint
- [ ] OKX Onchain OS APIs used (Wallet Connect, Payment/x402)
- [ ] GitHub repo is public with README
- [ ] SKILL.md in repo root
- [ ] Create project X/Twitter account
- [ ] Record 2-min demo video: lobby → pick oripa → pay → pachinko ball drop → card reveal → Last One → explorer proof
- [ ] Reply to @XLayerOfficial announcement thread
- [ ] Complete registration form
