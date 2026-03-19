export interface Env {
  DB: D1Database
  XLAYER_RPC: string
  CONTRACT_ADDRESS: string
  PAYMENT_WALLET: string
  MINTER_PRIVATE_KEY: string
  OKX_API_KEY: string
  OKX_SECRET_KEY: string
  OKX_PASSPHRASE: string
  ADMIN_SECRET: string
}

let _env: Env | null = null

export function setEnv(env: Env) {
  _env = env
}

export function getEnv(): Env {
  if (_env) return _env
  const g = globalThis as unknown as { __env?: Env }
  if (g.__env) return g.__env
  // Dev fallback — return stub env
  return {
    DB: null as unknown as D1Database,
    XLAYER_RPC: 'https://rpc.xlayer.tech',
    CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000000',
    PAYMENT_WALLET: '0x0000000000000000000000000000000000000000',
    MINTER_PRIVATE_KEY: '',
    OKX_API_KEY: '',
    OKX_SECRET_KEY: '',
    OKX_PASSPHRASE: '',
    ADMIN_SECRET: 'dev-secret',
  }
}

export function hasDb(): boolean {
  const env = getEnv()
  return env.DB !== null && env.DB !== undefined
}
