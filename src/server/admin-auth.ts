import { ethers } from 'ethers'
import type { Env } from './env'

// ── Challenge Store (in-memory, per-isolate) ──

interface Challenge {
  message: string
  address: string
  expiresAt: number
}

const challengeStore = new Map<string, Challenge>()

// Clean expired challenges periodically
function cleanExpiredChallenges() {
  const now = Date.now()
  for (const [nonce, challenge] of challengeStore) {
    if (challenge.expiresAt < now) challengeStore.delete(nonce)
  }
}

export function generateChallenge(address: string): {
  message: string
  nonce: string
  expiresAt: number
} {
  cleanExpiredChallenges()

  const nonce = crypto.randomUUID()
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

  const message = [
    'Sign this message to authenticate as OripaX admin.',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Chain: X Layer (196)`,
  ].join('\n')

  challengeStore.set(nonce, { message, address: address.toLowerCase(), expiresAt })

  return { message, nonce, expiresAt }
}

export function consumeChallenge(
  nonce: string,
  address: string
): { message: string } | null {
  const challenge = challengeStore.get(nonce)
  if (!challenge) return null
  if (challenge.expiresAt < Date.now()) {
    challengeStore.delete(nonce)
    return null
  }
  if (challenge.address !== address.toLowerCase()) return null

  // One-time use
  challengeStore.delete(nonce)
  return { message: challenge.message }
}

// ── Signature Verification ──

export function verifySignature(message: string, signature: string): string {
  // ethers.verifyMessage handles EIP-191 personal_sign recovery
  // Returns checksummed address
  return ethers.verifyMessage(message, signature)
}

// ── JWT (HS256 via Web Crypto) ──

function base64UrlEncode(data: Uint8Array): string {
  const str = btoa(String.fromCharCode(...data))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textToBytes(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, textToBytes(data) as BufferSource)
  return base64UrlEncode(new Uint8Array(sig))
}

async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    textToBytes(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  return crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(signature) as BufferSource,
    textToBytes(data) as BufferSource
  )
}

interface JwtPayload {
  sub: string // admin address
  iat: number
  exp: number
}

const JWT_EXPIRY = 24 * 60 * 60 // 24 hours in seconds

export async function createJwt(address: string, secret: string): Promise<string> {
  const header = base64UrlEncode(
    textToBytes(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  )
  const now = Math.floor(Date.now() / 1000)
  const payload = base64UrlEncode(
    textToBytes(
      JSON.stringify({
        sub: address.toLowerCase(),
        iat: now,
        exp: now + JWT_EXPIRY,
      } satisfies JwtPayload)
    )
  )
  const signature = await hmacSign(`${header}.${payload}`, secret)
  return `${header}.${payload}.${signature}`
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts as [string, string, string]

  const valid = await hmacVerify(`${header}.${payload}`, signature, secret)
  if (!valid) return null

  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload))
    ) as JwtPayload

    // Check expiry
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null

    return decoded
  } catch {
    return null
  }
}

// ── Admin Check ──

export function isAdminAddress(address: string, adminWallets: string): boolean {
  if (!adminWallets) return false
  const allowed = adminWallets
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(address.toLowerCase())
}

// ── Request Helpers ──

export function extractToken(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check cookie
  const cookie = request.headers.get('Cookie')
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/)
    if (match?.[1]) return match[1]
  }

  return null
}

/**
 * Full admin auth middleware.
 * Returns the admin address if valid, or null if unauthorized.
 */
export async function requireAdmin(
  request: Request,
  env: Env
): Promise<string | null> {
  const token = extractToken(request)
  if (!token) return null

  const payload = await verifyJwt(token, env.JWT_SECRET)
  if (!payload) return null

  if (!isAdminAddress(payload.sub, env.ADMIN_WALLETS)) return null

  return payload.sub
}
